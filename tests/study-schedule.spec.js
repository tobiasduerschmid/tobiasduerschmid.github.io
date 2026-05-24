// @ts-check
//
// Tests for the CS 35L study schedule feature.
//
// Acceptance criteria under test (from the originating user story):
//
//   AC1 — Given that the user is on the CS 35L page, when the user clicks
//         "Schedule Study", then they can select a given time period between
//         four days and two weeks for their study plan.
//
//   AC2 — Given that the user has selected a valid time range, when the user
//         clicks "Create Study Plan", then the SE Book will provide an
//         organized list of what tutorials and Gym questions to do each day
//         in their selected time range.
//
// Each acceptance criterion has its own describe-block, with the boundary
// cases (4 days, 14 days, < 4, > 14, non-numeric) and the per-day rendering
// covered as separate test cases.
//
const { test, expect } = require('@playwright/test');

const CS35L_URL = '/SEBook/CS35L.html';

async function openSchedulerModal(page) {
  await page.locator('#schedule-study-btn').click();
  await expect(page.locator('#study-schedule-modal')).toBeVisible();
}

test.describe('CS 35L Study Schedule — page entry point', () => {
  test('the CS 35L page exposes a Schedule Study button', async ({ page }) => {
    await page.goto(CS35L_URL);
    const btn = page.locator('#schedule-study-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/Schedule Study/i);
  });

  test('the time-range modal is not visible before the button is clicked', async ({ page }) => {
    await page.goto(CS35L_URL);
    await expect(page.locator('#study-schedule-modal')).toBeHidden();
  });
});

test.describe('AC1 — selecting a time period between four days and two weeks', () => {
  test('clicking Schedule Study reveals a number-input limited to 4–14 days', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    const input = page.locator('#study-schedule-days');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveAttribute('min', '4');
    await expect(input).toHaveAttribute('max', '14');
  });

  test('an associated label explains the 4–14 day range', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    const label = page.locator('label[for="study-schedule-days"]');
    await expect(label).toBeVisible();
    await expect(label).toHaveText(/4.*14|four.*fourteen|four.*two weeks/i);
  });

  test('the minimum 4-day plan is accepted', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('4');
    await page.locator('#create-study-plan-btn').click();

    await expect(page.locator('#study-schedule-error')).toBeHidden();
    await expect(page.locator('#study-plan-output')).toBeVisible();
  });

  test('the maximum 14-day (two-week) plan is accepted', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('14');
    await page.locator('#create-study-plan-btn').click();

    await expect(page.locator('#study-schedule-error')).toBeHidden();
    await expect(page.locator('#study-plan-output')).toBeVisible();
  });

  test('3 days (below minimum) is rejected with an error message', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('3');
    await page.locator('#create-study-plan-btn').click();

    const error = page.locator('#study-schedule-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/at least 4/i);
    await expect(page.locator('#study-plan-output')).toBeHidden();
  });

  test('15 days (above maximum) is rejected with an error message', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('15');
    await page.locator('#create-study-plan-btn').click();

    const error = page.locator('#study-schedule-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/14|two weeks/i);
    await expect(page.locator('#study-plan-output')).toBeHidden();
  });

  test('non-integer values are rejected', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    // Submit via the form so the JS validator (not the browser's built-in
    // numeric constraints) is the layer under test.
    await page.evaluate(() => {
      const input = /** @type {HTMLInputElement} */ (document.getElementById('study-schedule-days'));
      input.value = '5.5';
      document.getElementById('study-schedule-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });

    await expect(page.locator('#study-schedule-error')).toBeVisible();
    await expect(page.locator('#study-plan-output')).toBeHidden();
  });

  test('Escape closes the modal without generating a plan', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('#study-schedule-modal')).toBeHidden();
    await expect(page.locator('#study-plan-output')).toBeHidden();
  });
});

test.describe('AC2 — Create Study Plan renders an organized per-day list', () => {
  test('the result is broken down into one section per chosen day', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('7');
    await page.locator('#create-study-plan-btn').click();

    const dayCards = page.locator('#study-plan-output .study-schedule__day');
    await expect(dayCards).toHaveCount(7);

    // Each card carries a "Day N" heading.
    for (let i = 0; i < 7; i++) {
      await expect(dayCards.nth(i).locator('h4')).toHaveText(new RegExp(`Day\\s+${i + 1}\\b`));
    }
  });

  test('each plan lists at least one tutorial AND at least one gym question overall', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('7');
    await page.locator('#create-study-plan-btn').click();

    const tutorials = page.locator('#study-plan-output li[data-item-type="tutorial"]');
    const gym = page.locator('#study-plan-output li[data-item-type="gym"]');

    expect(await tutorials.count()).toBeGreaterThan(0);
    expect(await gym.count()).toBeGreaterThan(0);
  });

  test('each scheduled item links to its tutorial or gym URL', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('5');
    await page.locator('#create-study-plan-btn').click();

    const links = page.locator('#study-plan-output li a');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);

    for (let i = 0; i < linkCount; i++) {
      const href = await links.nth(i).getAttribute('href');
      // Must be a real internal route — never empty, never "#".
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
      expect(href.startsWith('/SEBook/') || href.startsWith('/se-gym/')).toBe(true);
    }
  });

  test('every item from the data file ends up in the schedule exactly once', async ({ page }) => {
    await page.goto(CS35L_URL);

    // Use the (validated, observable) script tag the include emits to derive
    // the spec — this guards against an item being silently dropped during
    // distribution.
    const expectedTitles = await page.evaluate(() => {
      const data = JSON.parse(document.getElementById('study-schedule-data').textContent || '');
      return data.items.map((i) => i.title);
    });
    expect(expectedTitles.length).toBeGreaterThan(0);

    await openSchedulerModal(page);
    await page.locator('#study-schedule-days').fill('7');
    await page.locator('#create-study-plan-btn').click();

    const scheduled = await page.locator('#study-plan-output li a').allTextContents();
    expect(scheduled.sort()).toEqual(expectedTitles.slice().sort());
  });

  test('items keep their original course order across days', async ({ page }) => {
    await page.goto(CS35L_URL);

    const expectedTitles = await page.evaluate(() => {
      const data = JSON.parse(document.getElementById('study-schedule-data').textContent || '');
      return data.items.map((i) => i.title);
    });

    await openSchedulerModal(page);
    await page.locator('#study-schedule-days').fill('6');
    await page.locator('#create-study-plan-btn').click();

    // Order across days/items must match the data file order (the pedagogical
    // sequence): foundations first, design/testing/UML last.
    const scheduled = await page.locator('#study-plan-output li a').allTextContents();
    expect(scheduled).toEqual(expectedTitles);
  });

  test('different day choices produce different schedules', async ({ page }) => {
    await page.goto(CS35L_URL);

    async function buildFor(days) {
      await page.locator('#schedule-study-btn').click();
      await page.locator('#study-schedule-days').fill(String(days));
      await page.locator('#create-study-plan-btn').click();
      const cards = page.locator('#study-plan-output .study-schedule__day');
      const count = await cards.count();
      const sizes = [];
      for (let i = 0; i < count; i++) {
        sizes.push(await cards.nth(i).locator('li').count());
      }
      return sizes;
    }

    const fourDay = await buildFor(4);
    const fourteenDay = await buildFor(14);

    expect(fourDay).toHaveLength(4);
    expect(fourteenDay).toHaveLength(14);
    expect(fourDay).not.toEqual(fourteenDay);

    // 4-day plan must pack more items per day than the 14-day plan.
    const fourDayMax = Math.max(...fourDay);
    const fourteenDayMax = Math.max(...fourteenDay);
    expect(fourDayMax).toBeGreaterThan(fourteenDayMax);
  });

  test('each day card distinguishes Tutorials from Gym items via a labeled badge', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('4');
    await page.locator('#create-study-plan-btn').click();

    // At least one of each kind should be flagged visibly so the learner can
    // tell hands-on tutorials apart from quiz review.
    await expect(page.locator('#study-plan-output .study-schedule__type-badge').first()).toBeVisible();
    await expect(page.locator('#study-plan-output .study-schedule__type-badge--gym').first()).toBeVisible();
  });

  test('submitting closes the modal and surfaces the plan in place', async ({ page }) => {
    await page.goto(CS35L_URL);
    await openSchedulerModal(page);

    await page.locator('#study-schedule-days').fill('5');
    await page.locator('#create-study-plan-btn').click();

    await expect(page.locator('#study-schedule-modal')).toBeHidden();
    await expect(page.locator('#study-plan-output')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pure-function tests for the schedule generator.
//
// The DOM tests above pin down the user-facing behavior. The pure-function
// tests below pin down the distribution algorithm itself so a refactor that
// breaks the contract fails loudly with a precise diff, not as a flaky end-
// to-end mismatch.
// ---------------------------------------------------------------------------
test.describe('StudySchedule.buildSchedule — distribution invariants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CS35L_URL);
    // The page already loads js/study-schedule.js — wait for the public API.
    await page.waitForFunction(() => !!window.StudySchedule);
  });

  test('returns exactly `days` buckets', async ({ page }) => {
    const sizes = await page.evaluate(() => {
      const items = Array.from({ length: 12 }, (_, i) => ({ title: 'i' + i, type: 'tutorial', url: '/x' }));
      return [4, 7, 10, 14].map((d) => window.StudySchedule.buildSchedule(items, d).length);
    });
    expect(sizes).toEqual([4, 7, 10, 14]);
  });

  test('preserves the full item list (no drops, no duplicates)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const items = Array.from({ length: 12 }, (_, i) => ({ title: 't' + i, type: 'tutorial', url: '/' + i }));
      const flat = window.StudySchedule.buildSchedule(items, 5).flat();
      return { len: flat.length, titles: flat.map((x) => x.title) };
    });
    expect(result.len).toBe(12);
    expect(result.titles).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11']);
  });

  test('distributes the extras to the earliest days (largest-first front-loading)', async ({ page }) => {
    const bucketSizes = await page.evaluate(() => {
      const items = Array.from({ length: 13 }, (_, i) => ({ title: 't' + i, type: 'tutorial', url: '/' + i }));
      return window.StudySchedule.buildSchedule(items, 5).map((bucket) => bucket.length);
    });
    // 13 items / 5 days = 2 base + 3 remainder, so the first three days have
    // 3 items and the last two have 2.
    expect(bucketSizes).toEqual([3, 3, 3, 2, 2]);
  });

  test('validateDays accepts 4–14 and rejects everything else', async ({ page }) => {
    const verdicts = await page.evaluate(() => {
      const v = window.StudySchedule.validateDays;
      return {
        four: v(4).ok,
        fourteen: v(14).ok,
        seven: v(7).ok,
        three: v(3).ok,
        fifteen: v(15).ok,
        fractional: v(5.5).ok,
        text: v('abc').ok,
        empty: v('').ok,
      };
    });
    expect(verdicts).toEqual({
      four: true,
      fourteen: true,
      seven: true,
      three: false,
      fifteen: false,
      fractional: false,
      text: false,
      empty: false,
    });
  });
});
