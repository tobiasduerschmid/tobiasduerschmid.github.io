// @ts-check
// The design-review exercise (design_review steps) in the agent design
// reviews tutorial. The local model is replaced only at its inference
// boundary (runtime.generate), so prompts, parsing, the quote and signal
// guards, ratings, and the authored coaching all run as in production.
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

const URL = '/SEBook/development_practices/agent-design-reviews-tutorial';
const STEPS = YAML.parse(fs.readFileSync(path.join(__dirname, '../_data/tutorials/agent-design-reviews.yml'), 'utf8')).steps;
const OWN_WORDS = 'Adding BruinPay changes the PaymentGateway interface plus OrderService, RewardsService and Order, ' +
  'because each names StripeCard or StripeCharge. Fix: declare charge with our own PaymentMethod and Receipt ' +
  'types and translate inside StripeGateway.';

async function open(page) {
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: STEPS[0].title, exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('textbox', { name: 'Review comment' })).toBeVisible();
}

function comment(page) {
  return page.getByRole('textbox', { name: 'Review comment' });
}

async function appendToComment(page, text) {
  const box = comment(page);
  await box.fill((await box.inputValue()).trimEnd() + ' ' + text);
}

/**
 * Pretend the model is downloaded and answer each criterion from a script:
 * replies[criterion] is the model's raw text for that question.
 */
async function stubModel(page, replies) {
  await page.waitForFunction(() => window._tutorial && window._tutorial.llmAddon);
  await page.evaluate(async scripted => {
    const addon = window._tutorial.llmAddon;
    const questions = { 'about the design flaw?': 'flaw', 'about what goes wrong?': 'consequence', 'about the fix?': 'fix' };
    window.__reviewPrompts = [];
    addon.runtime.generate = async messages => {
      const user = messages[1].content;
      window.__reviewPrompts.push(user);
      const criterion = Object.entries(questions).find(([text]) => user.endsWith(text))[1];
      return { text: scripted[criterion], finishReason: 'stop' };
    };
    // prepare() runs again after a check; keep the stub's "downloaded" state,
    // and let no device check still in flight overwrite it.
    addon.prepareRequest = (addon.prepareRequest || 0) + 1;
    addon.prepare = async () => { addon.plan = { cached: true, canLoad: true }; addon.unavailable = ''; addon.refresh(); };
    await addon.prepare();
  }, replies);
}

test.describe('design review steps', () => {
  test('a review step shows only the agent\'s diagram, and Next waits for the comparison', async ({ page }) => {
    await open(page);
    const pane = page.getByRole('region', { name: 'Diagram', exact: true });
    await expect(pane.getByRole('region', { name: /UML class diagram/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Editor/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /Code beside diagram/ })).toBeHidden();
    await expect(comment(page)).toHaveValue(/^Flaw: PaymentGateway is meant to hide/);
    await expect(page.getByRole('button', { name: 'Compare with the expert review' })).toBeDisabled();
    await expect(page.getByText('Write your review and compare it with the expert review to continue')).toBeVisible();
  });

  test('comparing needs the minimum number of the learner\'s own words, then reveals the lesson and unlocks Next', async ({ page }) => {
    await open(page);
    const compare = page.getByRole('button', { name: 'Compare with the expert review' });
    const words = OWN_WORDS.split(' ');
    // The scaffold's words do not count; 24 of the learner's own words are one short.
    await appendToComment(page, words.slice(0, 24).join(' '));
    await expect(compare).toBeDisabled();
    await expect(page.getByText('24 of 25 words of your own written', { exact: false })).toBeVisible();
    await appendToComment(page, words.slice(24).join(' '));
    await expect(compare).toBeEnabled();
    await compare.click();
    await expect(page.getByRole('heading', { name: 'Lesson learned: Hide What Is Likely to Change' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'The flaw, annotated' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'The fixed design' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
  });

  test('a model check reports both ratings and coaches the missing parts without revealing the expert review', async ({ page }) => {
    await open(page);
    await appendToComment(page, 'What goes wrong: it will be bad for students. Fix: maybe refactor it.');
    await stubModel(page, {
      flaw: 'VERDICT: YES\nQUOTE: its operations take a StripeCard and return a StripeCharge',
      consequence: 'VERDICT: NO\nQUOTE: NONE',
      fix: 'VERDICT: PARTLY\nQUOTE: maybe refactor it',
    });
    const check = page.getByRole('button', { name: 'Check my review' });
    await expect(check).toBeEnabled();
    await check.click();
    const reading = page.getByRole('region', { name: 'The review assistant’s reading' });
    await expect(reading.getByRole('heading')).toBeFocused();
    await expect(reading.getByText('Close', { exact: true })).toBeVisible();
    await expect(reading.getByText('Not yet convincing', { exact: true })).toBeVisible();
    await expect(reading).toContainText('Trace the Given change: before BruinCard payments work');
    await expect(reading).toContainText('Propose a change to the interface itself');
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeHidden();

    // A second check climbs each unmet criterion's ladder.
    await check.click();
    await expect(reading).toContainText('Could a BruinPayGateway implement charge() exactly as declared?');

    const prompts = await page.evaluate(() => window.__reviewPrompts);
    expect(prompts).toHaveLength(6);
    expect(prompts.every(prompt => prompt.includes('What goes wrong: it will be bad for students.'))).toBe(true);
    expect(prompts.some(prompt => prompt.includes('Lesson learned'))).toBe(false);
  });

  test('a quote the comment does not contain earns no credit', async ({ page }) => {
    await open(page);
    await appendToComment(page, 'What goes wrong: nothing much. Fix: none needed.');
    await stubModel(page, {
      flaw: 'VERDICT: YES\nQUOTE: its operations take a StripeCard and return a StripeCharge',
      consequence: 'VERDICT: YES\nQUOTE: BruinPay forces four classes to change',
      fix: 'VERDICT: YES\nQUOTE: use provider-neutral types',
    });
    await page.getByRole('button', { name: 'Check my review' }).click();
    const reading = page.getByRole('region', { name: 'The review assistant’s reading' });
    await expect(reading.getByText('Not yet convincing', { exact: true })).toBeVisible();
    await expect(reading.getByText('Close', { exact: true })).toBeVisible();
  });

  test('without a downloaded model, Check explains why it is unavailable and comparing still works', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Check my review' })).toBeDisabled();
    await expect(page.getByText(/Checking needs the local model|Preparing the review assistant|You can still compare/)).toBeVisible();
    await appendToComment(page, OWN_WORDS);
    await page.getByRole('button', { name: 'Compare with the expert review' }).click();
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeVisible();
  });

  test('the comment and the comparison survive a reload, and Reset Step clears them after confirming', async ({ page }) => {
    await open(page);
    await appendToComment(page, OWN_WORDS);
    await page.getByRole('button', { name: 'Compare with the expert review' }).click();
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeVisible();

    await page.reload();
    await expect(comment(page)).toHaveValue(new RegExp(OWN_WORDS.slice(-40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 60000 });
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();

    await page.getByRole('link', { name: /Reset Current Step/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset the current step?' });
    await expect(dialog).toContainText('your review comment');
    await dialog.getByRole('button', { name: 'Reset step' }).click();
    await expect(comment(page)).toHaveValue(/^Flaw: PaymentGateway is meant to hide/);
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeHidden();
    await expect(page.getByText('Write your review and compare it with the expert review to continue')).toBeVisible();
  });

  test('the review meets WCAG 2.2 AA in light and dark mode, before and after the comparison', async ({ page }) => {
    await open(page);
    await auditInteractiveState(page, 'design review before comparing', { include: '.tutorial-design-review' });
    await appendToComment(page, OWN_WORDS);
    await page.getByRole('button', { name: 'Compare with the expert review' }).click();
    await expect(page.getByRole('heading', { name: /Lesson learned/ })).toBeVisible();
    await auditInteractiveState(page, 'design review after comparing', { include: '.tutorial-design-review' });
  });

  test('every review opens with its case and the agent\'s diagrams, not the fixed design, and meets WCAG 2.2 AA', async ({ page }) => {
    test.setTimeout(300000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const step of STEPS) {
      // A hash names the step; it only takes effect on a fresh page load.
      await page.goto('about:blank');
      await page.goto(URL + '#' + step.key);
      await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible({ timeout: 60000 });
      for (const card of ['You asked the agent', 'User story', 'The agent\'s reply', 'Given']) {
        await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible();
      }
      await expect(comment(page)).toBeVisible();
      const pane = page.getByRole('region', { name: 'Diagram', exact: true });
      const diagrams = step.design_review.diagrams;
      // One diagram is titled; several are tabs.
      for (const diagram of diagrams) {
        const name = diagrams.length > 1 ? pane.getByRole('tab', { name: diagram.label }) : pane.getByText(diagram.label, { exact: true });
        await expect(name).toBeVisible();
      }
      const first = diagrams[0];
      await expect(pane.getByRole('region', { name: new RegExp('UML ' + first.type + ' diagram') })).toBeVisible();
      await expect(pane.getByText(step.design_review.fixed.label, { exact: true })).toHaveCount(0);
      await auditInteractiveState(page, step.title, { include: '.tutorial-design-review' });
    }
    expect(errors).toEqual([]);
  });

  test('the print view shows the case, the diagram, and a writing area, and hides the expert review', async ({ page }) => {
    await page.goto(URL + '/print');
    const review = page.getByRole('region', { name: 'Design review' }).first();
    await expect(review).toContainText('BruinCard');
    await expect(review.locator('.tutorial-design-review-print__writing')).toBeVisible();
    await expect(review.getByRole('img').first()).toBeVisible({ timeout: 30000 });
    await expect(review.getByText('Lesson learned: Hide What Is Likely to Change')).toBeHidden();

    await page.goto(URL + '/print?instructor-mode=true');
    await expect(page.getByText('Lesson learned: Hide What Is Likely to Change')).toBeVisible();
  });
});
