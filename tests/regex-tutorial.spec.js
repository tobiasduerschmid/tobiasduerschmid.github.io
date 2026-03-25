// @ts-check
const { test, expect } = require('@playwright/test');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Type a regex into a free-text or fixer exercise input. */
async function typeRegex(page, exId, pattern) {
  const input = page.locator(`.rt-input[data-exid="${exId}"]`);
  await input.fill(pattern);
}

/** Click a Parsons fragment in the bank to move it to the drop zone. */
async function clickFragment(page, exId, fragText) {
  const bank = page.locator(`.rt-parsons-bank[data-exid="${exId}"]`);
  // CSS attribute selectors need backslashes double-escaped
  const escaped = fragText.replace(/\\/g, '\\\\');
  await bank.locator(`.rt-frag[data-frag="${escaped}"]`).click();
}

/** Click the "Check Answer" button for an exercise. */
async function checkAnswer(page, exId) {
  await page.locator(`.rt-btn-check[data-exid="${exId}"]`).click();
}

/** Assert the result message shows success. */
async function expectPass(page, exId) {
  const result = page.locator(`.rt-result[data-exid="${exId}"]`);
  await expect(result).toBeVisible();
  await expect(result).toHaveClass(/rt-result-pass/);
}

/** Assert the result message shows failure. */
async function expectFail(page, exId) {
  const result = page.locator(`.rt-result[data-exid="${exId}"]`);
  await expect(result).toBeVisible();
  await expect(result).toHaveClass(/rt-result-fail/);
}

/** Clear localStorage for fresh state. */
async function clearProgress(page) {
  await page.evaluate(() => {
    localStorage.removeItem('regex-tutorial-progress');
    localStorage.removeItem('regex-tutorial-advanced-progress');
  });
}

/**
 * Read exercise metadata from the page's JS engine.
 * Returns { exercises: [...], sections: [...] } without hardcoding anything.
 */
async function getExerciseData(page) {
  return page.evaluate(() => {
    // The IIFE stores EXERCISES in a closure, but we can scrape the DOM
    const cards = document.querySelectorAll('.rt-exercise');
    const exercises = [];
    for (const card of cards) {
      const id = card.id.replace('ex-', '');
      const isParsons = !!card.querySelector('.rt-parsons');
      const isFixer = !!card.querySelector('.rt-input-fixer');
      const type = isParsons ? 'parsons' : isFixer ? 'fixer' : 'free';
      const brokenValue =
        isFixer ? card.querySelector('.rt-input')?.value || '' : null;
      const hasSample = !!card.querySelector('.rt-sample');
      const hasViz = !!card.querySelector('.rt-viz');
      const hasHint = !!card.querySelector('.rt-hint');
      const testCount = card.querySelectorAll('.rt-test').length;

      // For Parsons, grab fragments from the bank and drop zone
      let fragments = null;
      if (isParsons) {
        const allFrags = card.querySelectorAll('.rt-frag');
        fragments = Array.from(allFrags).map(
          (f) => f.getAttribute('data-frag') || ''
        );
      }

      exercises.push({
        id,
        type,
        brokenValue,
        hasSample,
        hasViz,
        hasHint,
        testCount,
        fragments,
      });
    }

    const sectionEls = document.querySelectorAll('.rt-section');
    const sections = Array.from(sectionEls).map(
      (s) => s.getAttribute('data-section') || ''
    );

    return { exercises, sections };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BASICS TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════

test.describe('RegEx Tutorial: Basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial.html');
    await clearProgress(page);
    await page.reload();
  });

  // ── Page Structure ──────────────────────────────────────────────────────

  test('page loads with title and zero progress', async ({ page }) => {
    await expect(page).toHaveTitle(/RegEx/i);
    // Progress should show "0 / N" where N is the total exercise count
    const label = await page.locator('#rt-progress-label').textContent();
    expect(label).toMatch(/^0 \/ \d+/);
  });

  test('every section has at least one exercise', async ({ page }) => {
    const data = await getExerciseData(page);
    expect(data.sections.length).toBeGreaterThanOrEqual(1);
    expect(data.exercises.length).toBeGreaterThanOrEqual(1);
    // Every section container rendered at least one exercise card inside it
    for (const section of data.sections) {
      const sectionEl = page.locator(
        `.rt-section[data-section="${section}"]`
      );
      const cards = sectionEl.locator('.rt-exercise');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('link to advanced tutorial is present', async ({ page }) => {
    // Use #main-content to avoid matching nav sidebar links
    await expect(
      page.locator('#main-content a[href="/SEBook/tools/regex-tutorial-advanced.html"]')
    ).toBeVisible();
  });

  // ── Exercise Type: Free-text ────────────────────────────────────────────

  test('free-text: typing a correct regex and checking passes', async ({
    page,
  }) => {
    // Find the first free-text exercise
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');
    expect(freeEx).toBeTruthy();

    // Type a trivially-matching regex and verify the check button works
    // (We'll test specific solutions separately; here we test the mechanism)
    await typeRegex(page, freeEx.id, '.');
    await checkAnswer(page, freeEx.id);
    // Should get either pass or fail — result should be visible
    const result = page.locator(`.rt-result[data-exid="${freeEx.id}"]`);
    await expect(result).toBeVisible();
  });

  test('free-text: empty input shows prompt to enter a pattern', async ({
    page,
  }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');
    await checkAnswer(page, freeEx.id);
    const result = page.locator(`.rt-result[data-exid="${freeEx.id}"]`);
    await expect(result).toBeVisible();
    const text = await result.textContent();
    // Should prompt user to enter something (not say "correct" or show a fail count)
    expect(text.toLowerCase()).toMatch(/enter|type|empty|provide/);
  });

  // ── Exercise Type: Parsons ──────────────────────────────────────────────

  test('parsons: clicking fragments moves them to drop zone', async ({
    page,
  }) => {
    const data = await getExerciseData(page);
    const parsonsEx = data.exercises.find((e) => e.type === 'parsons');
    if (!parsonsEx) return; // skip if no parsons exercises exist

    const bank = page.locator(
      `.rt-parsons-bank[data-exid="${parsonsEx.id}"]`
    );
    const drop = page.locator(
      `.rt-parsons-drop[data-exid="${parsonsEx.id}"]`
    );

    const bankCountBefore = await bank.locator('.rt-frag').count();
    expect(bankCountBefore).toBeGreaterThan(0);

    // Click the first fragment
    await bank.locator('.rt-frag').first().click();

    // Drop zone should now have 1 fragment
    await expect(drop.locator('.rt-frag')).toHaveCount(1);
    // Bank should have one fewer
    await expect(bank.locator('.rt-frag')).toHaveCount(bankCountBefore - 1);
  });

  test('parsons: clear button returns all fragments to bank', async ({
    page,
  }) => {
    const data = await getExerciseData(page);
    const parsonsEx = data.exercises.find((e) => e.type === 'parsons');
    if (!parsonsEx) return;

    const bank = page.locator(
      `.rt-parsons-bank[data-exid="${parsonsEx.id}"]`
    );
    const drop = page.locator(
      `.rt-parsons-drop[data-exid="${parsonsEx.id}"]`
    );
    const totalFrags = await bank.locator('.rt-frag').count();

    // Move some fragments to drop
    await bank.locator('.rt-frag').first().click();
    await bank.locator('.rt-frag').first().click();

    // Clear
    await page.locator(`.rt-btn-clear[data-exid="${parsonsEx.id}"]`).click();
    await expect(drop.locator('.rt-frag')).toHaveCount(0);
    await expect(bank.locator('.rt-frag')).toHaveCount(totalFrags);
  });

  // ── Exercise Type: Fixer ────────────────────────────────────────────────

  test('fixer: starts with broken regex pre-filled', async ({ page }) => {
    const data = await getExerciseData(page);
    const fixerEx = data.exercises.find((e) => e.type === 'fixer');
    if (!fixerEx) return;

    const input = page.locator(`.rt-input[data-exid="${fixerEx.id}"]`);
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('fixer: hint is available behind details toggle', async ({ page }) => {
    const data = await getExerciseData(page);
    const fixerWithHint = data.exercises.find(
      (e) => e.type === 'fixer' && e.hasHint
    );
    if (!fixerWithHint) return;

    const hint = page.locator(`#ex-${fixerWithHint.id} .rt-hint`);
    await expect(hint).toBeAttached();
    await expect(hint.locator('summary')).toBeVisible();
  });

  // ── Live Feedback ───────────────────────────────────────────────────────

  test('test case icons update live when typing', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find(
      (e) => e.type === 'free' && e.testCount > 0
    );

    // Initially all icons should be neutral (no pass/fail class)
    const tests = page.locator(
      `.rt-tests[data-exid="${freeEx.id}"] .rt-test`
    );
    const firstTest = tests.first();
    await expect(firstTest).not.toHaveClass(/rt-test-pass|rt-test-fail/);

    // Type something to trigger live feedback
    await typeRegex(page, freeEx.id, '.');
    // Now at least one test should have a pass or fail class
    await expect(firstTest).toHaveClass(/rt-test-pass|rt-test-fail/);
  });

  test('sample text highlights matches in real time', async ({ page }) => {
    const data = await getExerciseData(page);
    const withSample = data.exercises.find(
      (e) => e.type === 'free' && e.hasSample
    );
    if (!withSample) return;

    // Type a broad pattern that should produce highlights
    await typeRegex(page, withSample.id, '\\w+');
    const highlights = page.locator(
      `.rt-sample[data-exid="${withSample.id}"] .rt-match`
    );
    const count = await highlights.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Regex Compilation Errors ────────────────────────────────────────────

  test('invalid regex shows error message', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');

    await typeRegex(page, freeEx.id, '[unclosed');
    const error = page.locator(`.rt-error[data-exid="${freeEx.id}"]`);
    await expect(error).toBeVisible();
  });

  // ── Progress Tracking ──────────────────────────────────────────────────

  test('completing an exercise updates progress and persists', async ({
    page,
  }) => {
    const data = await getExerciseData(page);
    const totalStr = await page.locator('#rt-progress-label').textContent();
    const total = parseInt(totalStr.split('/')[1].trim());

    // Solve the first free-text exercise with a known-good pattern
    // We use literal-2 (match "error") as a reliable target
    const ex = data.exercises.find(
      (e) => e.id === 'literal-2' && e.type === 'free'
    );
    if (!ex) return;

    await typeRegex(page, 'literal-2', 'error');
    await checkAnswer(page, 'literal-2');
    await expectPass(page, 'literal-2');

    // Progress should update
    await expect(page.locator('#rt-progress-label')).toContainText(
      `1 / ${total}`
    );

    // Exercise card should have completed class
    await expect(page.locator('#ex-literal-2')).toHaveClass(/rt-complete/);

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('#rt-progress-label')).toContainText(
      `1 / ${total}`
    );
    await expect(page.locator('#ex-literal-2')).toHaveClass(/rt-complete/);
  });

  // ── Skip Button ─────────────────────────────────────────────────────────

  test('skip button scrolls to next exercise', async ({ page }) => {
    const data = await getExerciseData(page);
    if (data.exercises.length < 2) return;

    const first = data.exercises[0];
    const second = data.exercises[1];
    await page.locator(`.rt-btn-skip[data-exid="${first.id}"]`).click();
    await expect(page.locator(`#ex-${second.id}`)).toBeInViewport();
  });

  // ── Self-Explanation Prompts ────────────────────────────────────────────

  test('self-explanation prompt appears after correct answer', async ({
    page,
  }) => {
    await typeRegex(page, 'literal-2', 'error');
    await checkAnswer(page, 'literal-2');

    const selfExplain = page.locator('#ex-literal-2 .rt-self-explain');
    await expect(selfExplain).toBeAttached();

    // Expand the outer details (first summary is "Explain it to yourself")
    await selfExplain.locator(':scope > summary').click();
    await expect(selfExplain.locator('.rt-se-question')).toBeVisible();

    // Nested reveal for the answer
    const answerDetails = selfExplain.locator('.rt-se-answer');
    await answerDetails.locator(':scope > summary').click();
    await expect(answerDetails.locator('p')).toBeVisible();
  });

  // ── Failure Feedback ────────────────────────────────────────────────────

  test('failure message includes diagnostic guidance', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');

    // Submit an obviously wrong answer
    await typeRegex(page, freeEx.id, 'ZZZZZ_NO_MATCH');
    await checkAnswer(page, freeEx.id);

    const result = page.locator(`.rt-result[data-exid="${freeEx.id}"]`);
    await expect(result).toBeVisible();
    await expect(result).toHaveClass(/rt-result-fail/);
    // Should contain some diagnostic text (not just "failed")
    const text = await result.textContent();
    expect(text.length).toBeGreaterThan(20);
  });

  // ── Visualizer ──────────────────────────────────────────────────────────

  test('visualizer renders and step/reset controls work', async ({
    page,
  }) => {
    const data = await getExerciseData(page);
    const vizEx = data.exercises.find((e) => e.hasViz);
    if (!vizEx) return;

    const viz = page.locator(`#ex-${vizEx.id} .rt-viz`);
    await expect(viz).toBeVisible();

    // Step forward
    const stepBtn = viz.locator('.rt-viz-btn-p');
    await stepBtn.click();
    const counter = viz.locator('.rt-viz-counter').first();
    await expect(counter).toContainText('1 /');

    // Step again
    await stepBtn.click();
    await expect(counter).toContainText('2 /');

    // Reset
    await viz.locator('[data-a="reset"]').first().click();
    await expect(counter).toContainText('0 /');
  });

  test('visualizer play button auto-advances', async ({ page }) => {
    const data = await getExerciseData(page);
    const vizEx = data.exercises.find((e) => e.hasViz);
    if (!vizEx) return;

    const viz = page.locator(`#ex-${vizEx.id} .rt-viz`);
    await viz.locator('[data-a="play"]').first().click();

    // Wait for auto-advance (1800ms interval per step)
    await page.waitForTimeout(4000);

    const text = await viz.locator('.rt-viz-counter').first().textContent();
    const stepNum = parseInt(text.split('/')[0].trim());
    expect(stepNum).toBeGreaterThan(1);
  });

  // ── Solution Verification ──────────────────────────────────────────────
  // These test the contract that specific solutions pass. They reference
  // exercise IDs (stable identifiers) and regex patterns. If an exercise
  // is removed, the test is skipped rather than failing.

  /** Solve a free/fixer exercise by ID, skipping if the exercise doesn't exist on the page. */
  async function solveIfExists(page, id, solution) {
    const card = page.locator(`#ex-${id}`);
    if ((await card.count()) === 0) return;
    await typeRegex(page, id, solution);
    await checkAnswer(page, id);
    await expectPass(page, id);
  }

  const basicsFreeAndFixerSolutions = [
    ['literal-2', 'error'],
    ['charclass-2', '[^a-zA-Z]'],
    ['meta character-1', '\\d'],
    ['meta character-2', '\\.[a-z]+'],
    ['anchor-0', '^\\d+$'],
    ['anchor-2', '\\bgo\\b'],
    ['anchor-3', '^[a-zA-Z0-9]+$'],
    ['quant-1', '\\b\\d{5}\\b'],
    ['quant-2', 'a+b'],
    ['quant-3', 'files?'],
    ['combine-1', 'gr[ae]y'],
    ['combine-2', '\\d{2}:\\d{2}'],
    ['combine-3', '^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])$'],
  ];

  for (const [id, solution] of basicsFreeAndFixerSolutions) {
    test(`solution accepted: ${id}`, async ({ page }) => {
      await solveIfExists(page, id, solution);
    });
  }

  // Parsons: solve by clicking fragments in order. If the exercise or
  // any fragment is missing, the test skips gracefully.
  const parsonsSolutions = [
    ['literal-1', ['p', 'r', 'i', 'n', 't']],
    ['charclass-1', ['[', 'a', 'e', 'i', 'o', 'u', ']']],
    ['anchor-1', ['^', '\\d', '+', '$']],
  ];

  for (const [id, frags] of parsonsSolutions) {
    test(`solution accepted: ${id} (parsons)`, async ({ page }) => {
      const card = page.locator(`#ex-${id}`);
      if ((await card.count()) === 0) return;
      for (const frag of frags) {
        await clickFragment(page, id, frag);
      }
      await checkAnswer(page, id);
      await expectPass(page, id);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════

test.describe('RegEx Tutorial: Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial-advanced.html');
    await clearProgress(page);
    await page.reload();
  });

  // ── Page Structure ──────────────────────────────────────────────────────

  test('page loads with title and zero progress', async ({ page }) => {
    await expect(page).toHaveTitle(/RegEx/i);
    const label = await page.locator('#rt-progress-label').textContent();
    expect(label).toMatch(/^0 \/ \d+/);
  });

  test('every section has at least one exercise', async ({ page }) => {
    const data = await getExerciseData(page);
    expect(data.sections.length).toBeGreaterThanOrEqual(1);
    for (const section of data.sections) {
      const cards = page.locator(
        `.rt-section[data-section="${section}"] .rt-exercise`
      );
      expect(await cards.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('link back to basics tutorial is present', async ({ page }) => {
    await expect(
      page.locator('#main-content a[href="/SEBook/tools/regex-tutorial.html"]').first()
    ).toBeVisible();
  });

  // ── Greedy vs. Lazy Discrimination ──────────────────────────────────────
  // These tests verify the matchCount mechanism correctly rejects greedy
  // patterns. They are essential correctness tests for the tutorial engine.

  test('greedy <.*> rejected for Tag Trouble', async ({ page }) => {
    const card = page.locator('#ex-greedy-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'greedy-1', '<.*>');
    await checkAnswer(page, 'greedy-1');
    await expectFail(page, 'greedy-1');
  });

  test('lazy <.*?> accepted for Tag Trouble', async ({ page }) => {
    const card = page.locator('#ex-greedy-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'greedy-1', '<.*?>');
    await checkAnswer(page, 'greedy-1');
    await expectPass(page, 'greedy-1');
  });

  test('negated character class <[^>]*> also accepted for Tag Trouble', async ({
    page,
  }) => {
    const card = page.locator('#ex-greedy-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'greedy-1', '<[^>]*>');
    await checkAnswer(page, 'greedy-1');
    await expectPass(page, 'greedy-1');
  });

  test('greedy ".*" rejected for Quoted Strings', async ({ page }) => {
    const card = page.locator('#ex-greedy-2');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'greedy-2', '".*"');
    await checkAnswer(page, 'greedy-2');
    await expectFail(page, 'greedy-2');
  });

  test('lazy ".*?" accepted for Quoted Strings', async ({ page }) => {
    const card = page.locator('#ex-greedy-2');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'greedy-2', '".*?"');
    await checkAnswer(page, 'greedy-2');
    await expectPass(page, 'greedy-2');
  });

  // ── Lookbehind Discrimination ──────────────────────────────────────────

  test('lookbehind correctly excludes $ from match', async ({ page }) => {
    const card = page.locator('#ex-look-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'look-1', '(?<=\\$)[\\d.]+');
    await checkAnswer(page, 'look-1');
    await expectPass(page, 'look-1');
  });

  test('including $ in match rejected', async ({ page }) => {
    const card = page.locator('#ex-look-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'look-1', '\\$[\\d.]+');
    await checkAnswer(page, 'look-1');
    await expectFail(page, 'look-1');
  });

  // ── Fixer Broken-Regex Discrimination ──────────────────────────────────

  test('pre-filled broken regex fails (integrate-4)', async ({ page }) => {
    const card = page.locator('#ex-integrate-4');
    if ((await card.count()) === 0) return;

    // Verify it starts with something pre-filled
    const input = page.locator('.rt-input[data-exid="integrate-4"]');
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(0);

    // Submitting the broken regex should fail
    await checkAnswer(page, 'integrate-4');
    await expectFail(page, 'integrate-4');
  });

  test('lookbehind fix passes (integrate-4)', async ({ page }) => {
    const card = page.locator('#ex-integrate-4');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'integrate-4', '(?<=ERROR: )\\w+');
    await checkAnswer(page, 'integrate-4');
    await expectPass(page, 'integrate-4');
  });

  // ── Greedy/Lazy Visualizer ─────────────────────────────────────────────

  test('greedy/lazy visualizer has two scenarios', async ({ page }) => {
    const card = page.locator('#ex-greedy-1');
    if ((await card.count()) === 0) return;

    const viz = card.locator('.rt-viz');
    if ((await viz.count()) === 0) return;

    const scenarios = viz.locator('.rt-viz-sc');
    await expect(scenarios).toHaveCount(2);
  });

  // ── Solution Verification ──────────────────────────────────────────────

  async function solveIfExists(page, id, solution) {
    const card = page.locator(`#ex-${id}`);
    if ((await card.count()) === 0) return;
    await typeRegex(page, id, solution);
    await checkAnswer(page, id);
    await expectPass(page, id);
  }

  const advancedSolutions = [
    ['review-1', '\\b\\d+\\b'],
    ['review-2', '^\\w+@\\w+\\.[a-zA-Z]+$'],
    ['review-3', '\\b\\d{4}\\b'],
    ['greedy-1', '<.*?>'],
    ['greedy-2', '".*?"'],
    ['group-1', '(na){2,}'],
    ['group-2', '^[A-Z]{3}$'],
    ['look-1', '(?<=\\$)[\\d.]+'],
    ['look-2', '^(?=.*\\d)(?=.*[A-Z]).+$'],
    ['integrate-1', '^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$'],
    ['integrate-2', '^[A-Z]\\d{9}$'],
    ['integrate-3', '\\$\\d+(\\.\\d{2})?'],
    ['integrate-4', '(?<=ERROR: )\\w+'],
  ];

  for (const [id, solution] of advancedSolutions) {
    test(`solution accepted: ${id}`, async ({ page }) => {
      await solveIfExists(page, id, solution);
    });
  }

  // ── Progress Independence ──────────────────────────────────────────────

  test('advanced progress is independent from basics', async ({ page }) => {
    await typeRegex(page, 'review-1', '\\b\\d+\\b');
    await checkAnswer(page, 'review-1');
    await expectPass(page, 'review-1');

    const advLabel = await page.locator('#rt-progress-label').textContent();
    expect(advLabel).toMatch(/^1 \/ \d+/);

    // Basics page should still show zero
    await page.goto('/SEBook/tools/regex-tutorial.html');
    const basicsLabel = await page.locator('#rt-progress-label').textContent();
    expect(basicsLabel).toMatch(/^0 \/ \d+/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PAGE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe('RegEx Tutorial: Navigation', () => {
  test('basics page links to advanced', async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial.html');
    // Use main content link, not the sidebar nav link
    await page
      .locator('#main-content a[href="/SEBook/tools/regex-tutorial-advanced.html"]')
      .click();
    expect(page.url()).toContain('regex-tutorial-advanced');
  });

  test('advanced page links back to basics', async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial-advanced.html');
    await page
      .locator('#main-content a[href="/SEBook/tools/regex-tutorial.html"]')
      .first()
      .click();
    expect(page.url()).toContain('regex-tutorial.html');
    expect(page.url()).not.toContain('advanced');
  });

  test('reference guide links to both tutorials', async ({ page }) => {
    await page.goto('/SEBook/tools/regex.html');
    await expect(
      page.locator('#main-content a[href="/SEBook/tools/regex-tutorial.html"]').first()
    ).toBeAttached();
    await expect(
      page.locator('#main-content a[href="/SEBook/tools/regex-tutorial-advanced.html"]').first()
    ).toBeAttached();
  });
});
