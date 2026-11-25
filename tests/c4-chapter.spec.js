// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The C4 model chapter's opening (plan 4, Task 3; spec §12): the chapter is published as finished work, its
 * reading-path and cross-reference links land on sections that exist, and its prerequisites and companion tutorials
 * are reachable. The interface figures, the card, and figure sizing are covered by tests/c4-display.spec.js.
 */

const CHAPTER = '/SEBook/architecture/c4.html';

test('the published C4 chapter does not announce itself as a preview draft', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByRole('heading', { name: 'Why C4', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText(/preview draft/i)).toHaveCount(0);
});

test('every in-page link in the C4 chapter lands on an element with that id', async ({ page }) => {
  await page.goto(CHAPTER);
  const fragments = await page.getByRole('main').locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => decodeURIComponent((link.getAttribute('href') || '').slice(1))));
  const distinct = [...new Set(fragments)].filter(Boolean);
  expect(distinct.length).toBeGreaterThan(0);
  for (const fragment of distinct) {
    await expect(page.locator(`[id="${fragment}"]`), `#${fragment} in the C4 chapter`).toHaveCount(1);
  }
});

// Other chapters also have "Tools" and "Trade-offs" sections, so these two carry chapter-prefixed ids: deep links
// to them, and the combined book page (/SEBook/all.html, every chapter on one page), stay unambiguous.
const PREFIXED_SECTIONS = [['c4-tools', 'Tools'], ['c4-trade-offs', 'Trade-offs']];

test('deep links reach the Tools and Trade-offs sections by their chapter-prefixed ids', async ({ page }) => {
  await page.goto(CHAPTER);
  for (const [id, name] of PREFIXED_SECTIONS) {
    const target = page.locator(`[id="${id}"]`);
    const heading = page.getByRole('heading', { name, exact: true });
    // The layout puts an H1's id on the <section> it wraps, and keeps an H2's id on the heading itself.
    await expect(target.and(heading).or(target.locator(heading)), `#${id} is the ${name} section`).toHaveCount(1);
  }
});

test('on the combined book page, no other element shares the ids of the Tools and Trade-offs sections', async ({ request }) => {
  const response = await request.get('/SEBook/all.html');
  expect(response.status(), '/SEBook/all.html answers').toBe(200);
  const html = await response.text();
  for (const [id] of PREFIXED_SECTIONS) {
    const elements = html.match(new RegExp(`\\sid="${id}"`, 'g')) || [];
    expect(elements.length, `elements with id="${id}" on /SEBook/all.html`).toBe(1);
  }
});

test('the chapter opening links its prerequisite chapters and both C4 tutorials to pages that exist', async ({ page }) => {
  await page.goto(CHAPTER);
  const main = page.getByRole('main');
  const prerequisites = main.locator('p').filter({ hasText: 'Prerequisites:' });
  const practice = main.locator('p').filter({ hasText: 'Practice alongside:' });
  const opening = [
    prerequisites.getByRole('link', { name: 'software architecture chapter', exact: true }),
    prerequisites.getByRole('link', { name: 'class', exact: true }),
    prerequisites.getByRole('link', { name: 'sequence', exact: true }),
    prerequisites.getByRole('link', { name: 'interoperability chapter', exact: true }),
    practice.getByRole('link', { name: 'The C4 Model in Practice', exact: true }),
    practice.getByRole('link', { name: 'Describe an interface', exact: true }),
  ];
  for (const link of opening) {
    const href = await link.getAttribute('href');
    expect(href, 'an opening link has an href').toBeTruthy();
    const response = await page.request.get(String(href));
    expect(response.status(), `${href} answers`).toBe(200);
  }
});

// Zooming In (plan 4, Task 4): the waitlist "Try it" opens the editor on the Registration API's components with its
// task, a keyboard-only reader can do the task, the edit stays on the page, and the suggested owner waits in a reveal.
const WAITLIST_TASK = 'Add a waitlist responsibility to the component that should own it';
const API_COMPONENTS = ['Registration Coordinator', 'Enrollment Policy', 'Seat Gateway', 'Billing Gateway'];

function waitlistEditor(page) {
  return page.locator('[data-c4-editor]').filter({ hasText: WAITLIST_TASK });
}

function focusedOptionName(page) {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (!focused || focused.getAttribute('role') !== 'option') return null;
    return document.getElementById(focused.getAttribute('aria-labelledby')).textContent;
  });
}

test.describe('Zooming In: the waitlist Try it', () => {
  test('opens the editor on the component view of the Registration API and states the task', async ({ page }) => {
    await page.goto(CHAPTER);
    const editor = waitlistEditor(page);
    await expect(editor).toHaveCount(1);
    await expect(editor.getByText(`Task: ${WAITLIST_TASK}`, { exact: true })).toBeVisible();
    const canvas = editor.getByRole('region', { name: /^Canvas/ });
    await expect(canvas).toHaveAccessibleName('Canvas: Component view: Registration API');
    const elements = canvas.getByRole('listbox', { name: 'Elements in this view' });
    for (const name of API_COMPONENTS) {
      await expect(elements.getByRole('option', { name, exact: true }), `${name} is drawn`).toHaveCount(1);
    }
  });

  test('a keyboard-only reader can add the waitlist KNOW to the Seat Gateway, and the edit is not stored', async ({ page }) => {
    await page.goto(CHAPTER);
    const editor = waitlistEditor(page);
    const canvas = editor.getByRole('region', { name: /^Canvas/ });
    await expect(canvas).toHaveAccessibleName('Canvas: Component view: Registration API');
    await canvas.focus();
    for (let presses = 0; presses < 4 && (await focusedOptionName(page)) === null; presses += 1) await page.keyboard.press('Tab');
    const optionCount = await canvas.getByRole('option').count();
    for (let step = 0; step < optionCount && (await focusedOptionName(page)) !== 'Seat Gateway'; step += 1) {
      await page.keyboard.press('ArrowRight');
    }
    expect(await focusedOptionName(page), 'arrow keys reach the Seat Gateway').toBe('Seat Gateway');

    const inspector = editor.getByRole('region', { name: 'Inspector', exact: true });
    await expect(inspector.getByRole('heading', { level: 3 })).toHaveText('Seat Gateway');
    const responsibilities = inspector.getByRole('region', { name: 'Responsibilities' });
    const kind = responsibilities.getByRole('combobox', { name: 'Kind of the new responsibility' });
    await kind.focus();
    await kind.selectOption({ label: 'KNOW' });
    const text = responsibilities.getByRole('textbox', { name: 'New responsibility' });
    await text.focus();
    await page.keyboard.type('which students are waiting for each full section, in order');
    await responsibilities.getByRole('button', { name: 'Add responsibility' }).focus();
    await page.keyboard.press('Enter');

    await expect(responsibilities.getByRole('textbox', { name: 'Responsibility 3', exact: true }))
      .toHaveValue('which students are waiting for each full section, in order');
    expect(await page.evaluate(() => localStorage.getItem('c4-editor-draft')), 'a chapter embed keeps edits in memory').toBeNull();
  });

  test('the suggested owner stays hidden until the reader asks for it', async ({ page }) => {
    await page.goto(CHAPTER);
    const reveal = page.getByRole('group').filter({ has: page.getByText('Show the waitlist owner', { exact: true }) });
    const answer = reveal.getByText(/^The Seat Gateway/);
    await expect(answer).toBeHidden();
    await reveal.getByText('Show the waitlist owner', { exact: true }).click();
    await expect(answer).toBeVisible();
  });
});

// Practice (plan 4, Task 5): the near-transfer editor opens on the campus room-booking starter with its task, the
// suggested model waits in a reveal until the reader has tried, and the chapter ends by pointing at both C4 tutorials
// and at Brown's own example.
const BOOKING_TASK = 'Write the RB-04 responsibility, add containers to Room Booking and connect them, refine every system'
  + ' responsibility in a container with one owner for each KNOW and DECIDE, and label every relationship as a sentence.';
const BOOKING_CONTEXT = ['Student', 'Facilities Staff', 'Room Booking', 'Campus Single Sign-On', 'Campus Calendar'];

test.describe('Practice: campus room booking', () => {
  test('the near-transfer editor opens on the system context of Room Booking and states the task', async ({ page }) => {
    await page.goto(CHAPTER);
    const editor = page.locator('[data-c4-editor]').filter({ hasText: BOOKING_TASK });
    await expect(editor).toHaveCount(1);
    await expect(editor.getByText(`Task: ${BOOKING_TASK}`, { exact: true })).toBeVisible();
    const canvas = editor.getByRole('region', { name: /^Canvas/ });
    await expect(canvas).toHaveAccessibleName('Canvas: System context view: Room Booking');
    const elements = canvas.getByRole('listbox', { name: 'Elements in this view' });
    for (const name of BOOKING_CONTEXT) {
      await expect(elements.getByRole('option', { name, exact: true }), `${name} is drawn`).toHaveCount(1);
    }
  });

  test('the suggested model stays hidden until the reader asks for it', async ({ page }) => {
    await page.goto(CHAPTER);
    const summary = page.getByText('Show one suggested model', { exact: true });
    const reveal = page.getByRole('group').filter({ has: summary });
    const answer = reveal.getByText(/^RB-04 asks for a judgment/);
    await expect(answer).toBeHidden();
    await summary.click();
    await expect(answer).toBeVisible();
  });

  test('Keep Going links both C4 tutorials, which exist, and Brown\'s example diagrams on c4model.com', async ({ page }) => {
    await page.goto(CHAPTER);
    // The list right under the Keep Going heading (the layout wraps only H1 sections in <section>).
    const keepGoing = page.locator('#keep-going + ul');
    for (const name of ['The C4 Model in Practice', 'Describe an interface']) {
      const href = await keepGoing.getByRole('link', { name, exact: true }).getAttribute('href');
      const response = await page.request.get(String(href));
      expect(response.status(), `${name} (${href}) answers`).toBe(200);
    }
    for (const [name, href] of [['system context', 'https://c4model.com/diagrams/system-context'],
      ['container', 'https://c4model.com/diagrams/container'], ['component', 'https://c4model.com/diagrams/component']]) {
      await expect(keepGoing.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
  });
});
