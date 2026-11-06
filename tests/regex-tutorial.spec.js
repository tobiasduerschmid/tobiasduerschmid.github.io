// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const A11Y_FEATURE = 'regex-tutorial';
// Python is loaded lazily in the real worker; execution has its own shorter limit.
const PYTHON_READY_TIMEOUT = 45_000;

test.setTimeout(90_000);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Type a regex into a free-text or fixer exercise input. */
async function typeRegex(page, exId, pattern) {
  // Exercise IDs are also the authored public navigation anchors.
  const input = page.locator(`#ex-${exId}`).getByRole('textbox');
  await input.fill(pattern);
}

/** Click a Parsons fragment in the bank to move it to the drop zone. */
async function clickFragment(page, exId, fragText) {
  const bank = page.locator(`#ex-${exId}`).getByRole('group', {
    name: /^Choose fragments for the answer box/,
  });
  await bank.getByRole('button', { name: fragText, exact: true }).click();
}

/** Click the "Check Answer" button for an exercise. */
async function checkAnswer(page, exId) {
  await page.locator(`#ex-${exId}`).getByRole('button', {
    name: 'Check Answer', exact: true,
  }).click();
}

/** Assert the result message shows success. */
async function expectPass(page, exId) {
  const result = page.locator(`#ex-${exId}`).getByRole('status');
  await expect(result).toContainText('Correct! All test cases passed.', {
    timeout: PYTHON_READY_TIMEOUT,
  });
}

/** Assert the result message shows failure. */
async function expectFail(page, exId) {
  const result = page.locator(`#ex-${exId}`).getByRole('status');
  await expect(result).toContainText('Not quite', { timeout: PYTHON_READY_TIMEOUT });
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
  test('Python inline flags control case sensitivity when grading', async ({ page }) => {
    await typeRegex(page, 'literal-2', '(?i)error');
    await checkAnswer(page, 'literal-2');
    await expectFail(page, 'literal-2');

    await typeRegex(page, 'literal-2', '(?x) e r r o r');
    await checkAnswer(page, 'literal-2');
    await expectPass(page, 'literal-2');
  });

  test('Python decimal classes include Unicode digits and highlight them after an emoji', async ({ page }) => {
    const exercise = page.locator('#ex-meta-character-1');
    await typeRegex(page, 'meta-character-1', '[0-9]');
    await checkAnswer(page, 'meta-character-1');
    await expectFail(page, 'meta-character-1');

    await typeRegex(page, 'meta-character-1', '\\d');
    await checkAnswer(page, 'meta-character-1');
    await expectPass(page, 'meta-character-1');
    // The sample's match spans are the visual highlighting contract.
    const unicodeHighlights = exercise.locator('.rt-sample .rt-match')
      .filter({ hasText: /^[١٢]$/ });
    await expect(unicodeHighlights).toHaveText(['١', '٢']);
    await expect(exercise.locator('.rt-sample')).toContainText('🌿 Unicode digits: ١٢.');
    await a11yCheckpoint(page, 'regex basics — Unicode highlights', { feature: A11Y_FEATURE });
  });

  test('whole-input validation rejects a match that leaves a trailing newline', async ({ page }) => {
    await typeRegex(page, 'anchor-0', '^\\d+$');
    await checkAnswer(page, 'anchor-0');
    await expectFail(page, 'anchor-0');

    await typeRegex(page, 'anchor-0', '^\\d+\\Z');
    await checkAnswer(page, 'anchor-0');
    await expectPass(page, 'anchor-0');
  });

  for (const [id, tooPermissive, valid] of [
    ['anchor-0', '^\\d*\\Z', '^\\d+\\Z'],
    ['anchor-3', '^[a-zA-Z0-9]*\\Z', '^[a-zA-Z0-9]+\\Z'],
  ]) {
    test(`nonempty validator rejects an empty match in live and final feedback: ${id}`, async ({ page }) => {
      const exercise = page.locator(`#ex-${id}`);
      const input = exercise.getByRole('textbox');
      // Test rows have no semantic role; their authored label identifies the visible case.
      const emptyCase = exercise.locator('.rt-test').filter({ hasText: 'empty — should NOT match' });
      await input.fill(tooPermissive);
      await expect(emptyCase).toContainText('✗', { timeout: PYTHON_READY_TIMEOUT });
      await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
      await expectFail(page, id);
      await input.fill(valid);
      await expect(emptyCase).toContainText('✓', { timeout: PYTHON_READY_TIMEOUT });
      await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
      await expectPass(page, id);
    });
  }

  test('extraction grading rejects grouped digits and accepts an equivalent individual-digit pattern', async ({ page }) => {
    // Authored exercise IDs also identify the public navigation anchors.
    const exercise = page.locator('#ex-meta-character-1');
    const input = page.getByRole('textbox', { name: 'Python regular expression for Digit Detector', exact: true });
    await input.fill('\\d+');
    await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expectFail(page, 'meta-character-1');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('[^\\D]');
    await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expectPass(page, 'meta-character-1');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await a11yCheckpoint(page, 'regex basics — extraction feedback', { feature: A11Y_FEATURE });
  });

  test.beforeEach(async ({ page }) => {
    // Playwright creates a fresh browser context (including storage) per test.
    await page.goto('/SEBook/tools/regex-tutorial.html');
  });

  // ── Page Structure ──────────────────────────────────────────────────────

  test('page loads with title and zero progress', async ({ page }) => {
    await expect(page).toHaveTitle(/RegEx/i);
    await a11yCheckpoint(page, 'regex basics — initial exercises', { feature: A11Y_FEATURE });
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
    await typeRegex(page, 'literal-2', 'error');
    await checkAnswer(page, 'literal-2');
    await expectPass(page, 'literal-2');
    await expect(page.locator('#ex-literal-2').getByRole('button', {
      name: 'Check Answer', exact: true,
    })).toBeFocused();
    await a11yCheckpoint(page, 'regex basics — free-text feedback', { feature: A11Y_FEATURE });
  });

  test('free-text: empty input shows prompt to enter a pattern', async ({
    page,
  }) => {
    await checkAnswer(page, 'literal-2');
    const result = page.locator('#ex-literal-2').getByRole('status');
    // Should prompt user to enter something (not say "correct" or show a fail count)
    await expect(result).toContainText(/enter|type|empty|provide/i);
    await a11yCheckpoint(page, 'regex basics — empty-input prompt', { feature: A11Y_FEATURE });
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
    await a11yCheckpoint(page, 'regex basics — Parsons fragment moved', { feature: A11Y_FEATURE });
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
    await page.locator(`#ex-${parsonsEx.id}`).getByRole('button', {
      name: 'Clear', exact: true,
    }).click();
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
    await hint.locator('summary').click();
    await a11yCheckpoint(page, 'regex basics — fixer hint expanded', { feature: A11Y_FEATURE });
  });

  // ── Live Feedback ───────────────────────────────────────────────────────

  test('test case icons update live when typing', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find(
      (e) => e.type === 'free' && e.testCount > 0
    );

    // Test-case rows expose the learner's visible pass/fail symbol.
    const tests = page.locator(
      `.rt-tests[data-exid="${freeEx.id}"] .rt-test`
    );
    const firstTest = tests.first();
    await expect(firstTest).toContainText('●');

    // Type something to trigger live feedback
    await typeRegex(page, freeEx.id, '.');
    await expect(firstTest).toContainText('✗', { timeout: PYTHON_READY_TIMEOUT });
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
    await expect(highlights.first()).toBeVisible({ timeout: PYTHON_READY_TIMEOUT });
  });

  // ── Regex Compilation Errors ────────────────────────────────────────────

  test('invalid regex shows error message', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');

    await typeRegex(page, freeEx.id, '[unclosed');
    const error = page.locator(`#ex-${freeEx.id}`).getByRole('alert');
    await expect(error).toContainText(/unterminated character set/i, {
      timeout: PYTHON_READY_TIMEOUT,
    });
    await checkAnswer(page, freeEx.id);
    await expect(error).toContainText(/unterminated character set/i, {
      timeout: PYTHON_READY_TIMEOUT,
    });
    await expect(page.locator(`#ex-${freeEx.id}`).getByRole('button', {
      name: 'Check Answer', exact: true,
    })).toBeFocused();
    await a11yCheckpoint(page, 'regex basics — invalid-pattern error', { feature: A11Y_FEATURE });
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
    await expectPass(page, 'literal-2');

    const selfExplain = page.locator('#ex-literal-2 .rt-self-explain');
    await expect(selfExplain).toBeAttached();

    // The self-explain box is always visible (no outer details toggle)
    await expect(selfExplain.locator('.rt-se-question')).toBeVisible();

    // Nested reveal for the answer
    const answerDetails = selfExplain.locator('.rt-se-answer');
    await answerDetails.locator(':scope > summary').click();
    await expect(answerDetails.locator('p')).toBeVisible();
    await a11yCheckpoint(page, 'regex basics — self-explanation answer revealed', { feature: A11Y_FEATURE });
  });

  // ── Failure Feedback ────────────────────────────────────────────────────

  test('failure message includes diagnostic guidance', async ({ page }) => {
    const data = await getExerciseData(page);
    const freeEx = data.exercises.find((e) => e.type === 'free');

    // Submit an obviously wrong answer
    await typeRegex(page, freeEx.id, 'ZZZZZ_NO_MATCH');
    await checkAnswer(page, freeEx.id);

    const result = page.locator(`#ex-${freeEx.id}`).getByRole('status');
    await expectFail(page, freeEx.id);
    await expect(result).toContainText(/missing valid matches/i);
    await a11yCheckpoint(page, 'regex basics — failure guidance', { feature: A11Y_FEATURE });
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
    await a11yCheckpoint(page, 'regex basics — visualizer advanced', { feature: A11Y_FEATURE });

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

    await expect
      .poll(async () => {
        const text = await viz.locator('.rt-viz-counter').first().textContent();
        return parseInt(text.split('/')[0].trim(), 10);
      }, {
        timeout: 6_000,
        message: 'Expected the visualizer play control to advance beyond the first step',
      })
      .toBeGreaterThan(1);
  });

  // ── Solution Verification ──────────────────────────────────────────────
  // These test the contract that specific solutions pass. They reference
  // exercise IDs (public navigation anchors) and regex patterns.

  /** Solve a free/fixer exercise by its public navigation anchor. */
  async function solveExercise(page, id, solution) {
    await typeRegex(page, id, solution);
    await checkAnswer(page, id);
    await expectPass(page, id);
    await a11yCheckpoint(page, `regex basics — ${id} completed`, { feature: A11Y_FEATURE });
  }

  const basicsFreeAndFixerSolutions = [
    ['literal-2', 'error'],
    ['charclass-2', '[^a-zA-Z]'],
    ['meta-character-1', '\\d'],
    ['meta-character-2', '\\.[a-z]+'],
    ['anchor-0', '^\\d+\\Z'],
    ['anchor-2', '\\bgo\\b'],
    ['anchor-3', '^[a-zA-Z0-9]+\\Z'],
    ['quant-1', '\\b\\d{5}\\b'],
    ['quant-2', 'a+b'],
    ['quant-3', 'files?'],
    ['combine-1', 'gr[ae]y'],
    ['combine-2', '\\d{2}:\\d{2}'],
    ['combine-3', '^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])\\Z'],
  ];

  for (const [id, solution] of basicsFreeAndFixerSolutions) {
    test(`solution accepted: ${id}`, async ({ page }) => {
      await solveExercise(page, id, solution);
    });
  }

  // Parsons: solve by clicking the visible fragments in order.
  const parsonsSolutions = [
    ['literal-1', ['p', 'r', 'i', 'n', 't']],
    ['charclass-1', ['[', 'a', 'e', 'i', 'o', 'u', ']']],
    ['anchor-1', ['^', '\\d', '+', '\\Z']],
  ];

  for (const [id, frags] of parsonsSolutions) {
    test(`solution accepted: ${id} (parsons)`, async ({ page }) => {
      for (const frag of frags) {
        await clickFragment(page, id, frag);
      }
      await checkAnswer(page, id);
      await expectPass(page, id);
      await a11yCheckpoint(page, `regex basics — ${id} Parsons completed`, { feature: A11Y_FEATURE });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════

test.describe('RegEx Tutorial: Advanced', () => {
  test('Python named captures grade the captured email parts', async ({ page }) => {
    const exercise = page.locator('#ex-group-4');
    const input = exercise.getByRole('textbox', {
      name: 'Python regular expression for Named Email Parts', exact: true,
    });
    await input.fill('^(?P<user>NEVER)@(?P<domain>NONE)\\Z');
    await checkAnswer(page, 'group-4');
    await expectFail(page, 'group-4');

    await input.fill('^(?P<domain>\\w+)@(?P<user>\\w+\\.[a-zA-Z]+)\\Z');
    await checkAnswer(page, 'group-4');
    await expectFail(page, 'group-4');

    await input.fill('^(?P<user>\\w+)@(?P<domain>\\w+\\.[a-zA-Z]+)\\Z');
    await checkAnswer(page, 'group-4');

    await expectPass(page, 'group-4');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(exercise.getByRole('alert')).toBeHidden();
    await a11yCheckpoint(page, 'regex advanced — Python named captures', { feature: A11Y_FEATURE });
  });

  test('Python named backreferences can solve repeated syllables', async ({ page }) => {
    await typeRegex(page, 'group-1', '(?P<syllable>na)(?P=syllable)+');
    await checkAnswer(page, 'group-1');
    await expectPass(page, 'group-1');
  });

  test('Python word classes accept Unicode email components unless ASCII mode is selected', async ({ page }) => {
    const pattern = '^(?P<user>\\w+)@(?P<domain>\\w+\\.[a-zA-Z]+)\\Z';
    await typeRegex(page, 'group-4', '(?a)' + pattern);
    await checkAnswer(page, 'group-4');
    await expectFail(page, 'group-4');

    await typeRegex(page, 'group-4', pattern);
    await checkAnswer(page, 'group-4');
    await expectPass(page, 'group-4');
  });

  test('JavaScript named-group syntax is rejected and can be corrected to Python syntax', async ({ page }) => {
    const exercise = page.locator('#ex-group-5');
    await typeRegex(page, 'group-5', '^(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})\\Z');
    await expect(exercise.getByRole('alert')).toContainText(/unknown extension/i, {
      timeout: PYTHON_READY_TIMEOUT,
    });
    await expect(exercise.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');

    await typeRegex(page, 'group-5', '^(?P<year>\\d{4})-(?P<month>\\d{2})-(?P<day>\\d{2})\\Z');
    await checkAnswer(page, 'group-5');
    await expectPass(page, 'group-5');
    await expect(exercise.getByRole('alert')).toBeHidden();
  });

  test('named-group guidance uses Python syntax when captures are missing', async ({ page }) => {
    const exercise = page.locator('#ex-group-5');
    await typeRegex(page, 'group-5', '^\\d{4}-\\d{2}-\\d{2}\\Z');
    await checkAnswer(page, 'group-5');
    await expect(exercise.getByRole('status')).toContainText('(?P<year>...)', {
      timeout: PYTHON_READY_TIMEOUT,
    });
    await expect(exercise.getByRole('status')).toContainText('(?P<month>...)');
    await expect(exercise.getByRole('status')).toContainText('(?P<day>...)');
  });

  test('named log parser fragments form a working Python pattern', async ({ page }) => {
    for (const fragment of ['\\[(?P<level>', '\\w+', ')\\]', '\\s+', '(?P<code>', '\\d+', ')']) {
      await clickFragment(page, 'group-3', fragment);
    }
    await checkAnswer(page, 'group-3');
    await expectPass(page, 'group-3');
    await a11yCheckpoint(page, 'regex advanced — named-capture Parsons answer', { feature: A11Y_FEATURE });
  });

  test('extraction grading requires quoted spans and accepts an equivalent lazy pattern', async ({ page }) => {
    const exercise = page.locator('#ex-greedy-2');
    const input = page.getByRole('textbox', { name: 'Python regular expression for Quoted Strings', exact: true });
    // This returns two matches but includes unquoted separator text in the second.
    await input.fill('[^"]*".*?"');
    await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expectFail(page, 'greedy-2');
    await input.fill('"[^\\n]*?"');
    await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expectPass(page, 'greedy-2');
    await a11yCheckpoint(page, 'regex advanced — extraction feedback', { feature: A11Y_FEATURE });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial-advanced.html');
  });

  // ── Page Structure ──────────────────────────────────────────────────────

  test('page loads with title and zero progress', async ({ page }) => {
    await expect(page).toHaveTitle(/RegEx/i);
    await a11yCheckpoint(page, 'regex advanced — initial exercises', { feature: A11Y_FEATURE });
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
    await a11yCheckpoint(page, 'regex advanced — rejected greedy pattern', { feature: A11Y_FEATURE });
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

  test('Python rejects variable-width lookbehind and accepts a fixed-width correction', async ({ page }) => {
    const exercise = page.locator('#ex-look-1');
    await typeRegex(page, 'look-1', '(?<=\\$+)\\d+(?:\\.\\d+)?');
    await expect(exercise.getByRole('alert')).toContainText(/look-behind requires fixed-width pattern/i, {
      timeout: PYTHON_READY_TIMEOUT,
    });
    await expect(exercise.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await a11yCheckpoint(page, 'regex advanced — invalid Python lookbehind', { feature: A11Y_FEATURE });

    await typeRegex(page, 'look-1', '(?<=\\$)\\d+(?:\\.\\d+)?');
    await checkAnswer(page, 'look-1');
    await expectPass(page, 'look-1');
    await expect(exercise.getByRole('alert')).toBeHidden();
  });

  test('lookbehind correctly excludes $ from match', async ({ page }) => {
    const card = page.locator('#ex-look-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'look-1', '(?<=\\$)\\d+(?:\\.\\d+)?');
    await checkAnswer(page, 'look-1');
    await expectPass(page, 'look-1');
  });

  test('dollar extraction rejects a bare dot as a numeric amount', async ({ page }) => {
    const exercise = page.locator('#ex-look-1');
    await exercise.getByRole('textbox').fill('(?<=\\$)[\\d.]+');
    await exercise.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expectFail(page, 'look-1');
  });

  test('including $ in match rejected', async ({ page }) => {
    const card = page.locator('#ex-look-1');
    if ((await card.count()) === 0) return;
    await typeRegex(page, 'look-1', '\\$\\d+(?:\\.\\d+)?');
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

  async function solveExercise(page, id, solution) {
    await typeRegex(page, id, solution);
    await checkAnswer(page, id);
    await expectPass(page, id);
    await a11yCheckpoint(page, `regex advanced — ${id} completed`, { feature: A11Y_FEATURE });
  }

  const advancedSolutions = [
    ['review-1', '\\b\\d+\\b'],
    ['review-2', '^\\w+@\\w+\\.[a-zA-Z]+\\Z'],
    ['review-3', '\\b\\d{4}\\b'],
    ['greedy-1', '<.*?>'],
    ['greedy-2', '".*?"'],
    ['group-1', '(na){2,}'],
    ['group-2', '^[A-Z]{3}\\Z'],
    ['group-4', '^(?P<user>\\w+)@(?P<domain>\\w+\\.[a-zA-Z]+)\\Z'],
    ['group-5', '^(?P<year>\\d{4})-(?P<month>\\d{2})-(?P<day>\\d{2})\\Z'],
    ['look-1', '(?<=\\$)\\d+(?:\\.\\d+)?'],
    ['look-2', '^(?=.*\\d)(?=.*[A-Z]).+\\Z'],
    ['integrate-1', '^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\\Z'],
    ['integrate-2', '^[A-Z]\\d{9}\\Z'],
    ['integrate-3', '\\$\\d+(\\.\\d{2})?'],
    ['integrate-4', '(?<=ERROR: )\\w+'],
  ];

  for (const [id, solution] of advancedSolutions) {
    test(`solution accepted: ${id}`, async ({ page }) => {
      await solveExercise(page, id, solution);
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

test.describe('RegEx Tutorial: Python evaluation lifecycle', () => {
  test('both tutorial scripts keep basic fragments and advanced grading independent', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/SEBook/tools/regex-tutorial.html');
    const advancedPage = await page.request.get('/SEBook/tools/regex-tutorial-advanced.html');
    expect(advancedPage.ok()).toBe(true);
    // Reproduce the combined book's shared-document integration with the real
    // authored section containers and script, excluding unrelated chapters.
    await page.evaluate((html) => {
      const source = new DOMParser().parseFromString(html, 'text/html');
      const advancedSections = document.createElement('section');
      advancedSections.setAttribute('aria-label', 'Advanced regex exercises');
      for (const section of source.querySelectorAll('#main-content .rt-section')) {
        advancedSections.appendChild(section.cloneNode(true));
      }
      document.getElementById('main-content').appendChild(advancedSections);
    }, await advancedPage.text());
    await page.addScriptTag({ url: '/js/regex-tutorial-advanced.js' });

    await clickFragment(page, 'literal-1', 'p');
    const basicsAnswer = page.locator('#ex-literal-1').getByRole('group', { name: 'Answer fragments', exact: true });
    await expect(basicsAnswer.getByRole('button')).toHaveText(['p']);

    await typeRegex(page, 'group-4', '^(?P<user>\\w+)@(?P<domain>\\w+\\.[a-zA-Z]+)\\Z');
    await checkAnswer(page, 'group-4');
    await expectPass(page, 'group-4');
    await expect(basicsAnswer.getByRole('button')).toHaveText(['p']);
    expect(pageErrors, 'both tutorials must coexist without uncaught browser errors').toEqual([]);
  });

  test('an answer edited while Python loads cannot receive stale completion credit', async ({ page, context }) => {
    let releaseRuntime;
    let runtimeRequested = false;
    const runtimeGate = new Promise((resolve) => { releaseRuntime = resolve; });
    // Delay the genuine runtime download to reproduce slow startup without
    // replacing Python execution or manufacturing worker results.
    await context.route('**/pyodide.asm.wasm', async (route) => {
      runtimeRequested = true;
      await runtimeGate;
      await route.continue();
    });

    try {
      await page.goto('/SEBook/tools/regex-tutorial.html');
      await typeRegex(page, 'literal-2', 'error');
      await checkAnswer(page, 'literal-2');
      await expect.poll(() => runtimeRequested, {
        message: 'the real Python runtime download must be pending',
        timeout: PYTHON_READY_TIMEOUT,
      }).toBe(true);
      await expect(page.locator('#ex-literal-2').getByRole('button', {
        name: 'Stop', exact: true,
      })).toBeFocused();

      await typeRegex(page, 'literal-2', 'ZZZZZ_NO_MATCH');
      await checkAnswer(page, 'literal-2');
      releaseRuntime();

      await expectFail(page, 'literal-2');
      await expect(page.locator('#rt-progress-label')).toHaveText(/^0 \/ \d+/);
      await expect(page.locator('#ex-literal-2').getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#ex-literal-2').getByRole('button', {
        name: 'Check Answer', exact: true,
      })).toBeFocused();
    } finally {
      releaseRuntime();
      await context.unrouteAll({ behavior: 'wait' });
    }
  });

  test('an expensive Python pattern times out and the learner can retry', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/SEBook/tools/regex-tutorial.html');
    // Warm the real runtime before testing the separate execution bound.
    await typeRegex(page, 'literal-2', '(?i)error');
    await checkAnswer(page, 'literal-2');
    await expectFail(page, 'literal-2');

    const exercise = page.locator('#ex-literal-2');
    // Many ambiguous repetitions force backtracking on the exercise's own
    // sample and test cases, none of which contains the required exclamation.
    await typeRegex(page, 'literal-2', '(.*){64}!');
    await checkAnswer(page, 'literal-2');
    await expect(exercise.getByRole('alert')).toContainText(/timed out/i, {
      timeout: 10_000,
    });
    await expect(exercise.getByRole('button', { name: 'Check Answer', exact: true })).toBeEnabled();
    await expect(exercise.getByRole('button', { name: 'Check Answer', exact: true })).toBeFocused();
    await expect(page.locator('#rt-progress-label')).toHaveText(/^0 \/ \d+/);
    await a11yCheckpoint(page, 'regex basics — Python execution timeout', { feature: A11Y_FEATURE });

    await typeRegex(page, 'literal-2', 'error');
    await checkAnswer(page, 'literal-2');
    await expectPass(page, 'literal-2');
    await expect(page.locator('#rt-progress-label')).toHaveText(/^1 \/ \d+/);
    expect(pageErrors, 'timeout and recovery must not cause uncaught browser errors').toEqual([]);
  });

  test('stopping a Python evaluation returns focus and allows a new answer', async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial.html');
    await typeRegex(page, 'literal-2', '(?i)error');
    await checkAnswer(page, 'literal-2');
    await expectFail(page, 'literal-2');

    const exercise = page.locator('#ex-literal-2');
    const check = exercise.getByRole('button', { name: 'Check Answer', exact: true });
    await typeRegex(page, 'literal-2', '(.*){64}!');
    await checkAnswer(page, 'literal-2');
    await exercise.getByRole('button', { name: 'Stop', exact: true }).click();

    await expect(exercise.getByRole('status')).toContainText('Stopped.');
    await expect(check).toBeEnabled();
    await expect(check).toBeFocused();
    await expect(exercise.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
    await expect(page.locator('#rt-progress-label')).toHaveText(/^0 \/ \d+/);
    await a11yCheckpoint(page, 'regex basics — stopped Python evaluation', { feature: A11Y_FEATURE });

    await typeRegex(page, 'literal-2', 'error');
    await checkAnswer(page, 'literal-2');
    await expectPass(page, 'literal-2');
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
