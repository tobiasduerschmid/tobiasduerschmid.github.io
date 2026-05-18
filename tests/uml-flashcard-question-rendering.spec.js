// @ts-check
//
// Regression tests for UML class diagram flashcards whose questions reference
// a visual ("the following symbol", "these two relationships"). The diagram
// must appear inside the question, not only in the explanation, in both the
// SEBook flashcard widget and the SE Gym workout integration.
const { test, expect } = require('@playwright/test');

const SEBOOK_URL = '/SEBook/uml_class_diagram.html';
const GYM_URL = '/se-gym/';

const SAVED_BRUIN_HERO = {
  version: 1,
  kind: 'bruin',
  appearance: {
    presentation: 'male',
    skin: '#8b5a35',
    hairColor: '#3d2818',
    hairStyle: 'bald',
    eyeColor: '#1f140c',
    eyebrowStyle: 'arched',
    headStyle: 'default',
    eyeShape: 'round',
    noseShape: 'soft',
    mouthStyle: 'smile',
    blushStyle: 'none',
    facialHair: 'none',
    faceFeature: 'none',
  },
  body: { type: 'athletic' },
  outfit: {
    style: 'super-suit',
    suit: '#1F6EBD',
    capeOuter: '#15538f',
    capeInner: '#FFD100',
    accessory: 'none',
    accessories: [],
    emblem: '',
  },
};

async function setCookie(context, name, value) {
  await context.addCookies([{
    name,
    value: encodeURIComponent(value),
    domain: '127.0.0.1',
    path: '/',
  }]);
}

async function expectRenderedUml(question) {
  const umlContainer = question.locator('[data-uml-type="class"]');
  await expect(umlContainer).toBeVisible();
  // UMLShared.renderAll injects an <svg> child into each container after rendering.
  await expect(umlContainer.locator('svg')).toBeVisible({ timeout: 5000 });
}

test.describe('UML class diagram flashcards - question diagrams render in SEBook', () => {
  test('configured SE Gym hero appears beside the flashcards', async ({ page }) => {
    await page.addInitScript((hero) => {
      localStorage.setItem('se-gym-hero-avatar', JSON.stringify(hero));
    }, SAVED_BRUIN_HERO);

    await page.goto(SEBOOK_URL);

    await expect(page.getByRole('region', { name: /UML Class Diagram Flashcards flashcards/i })).toBeVisible();
    const flashcardHero = page.locator('.flashcards-avatar-side [data-gym-hero-svg]');
    await expect(flashcardHero).toBeVisible();
    await expect(flashcardHero).toHaveAttribute('data-hero-kind', 'bruin');
    await expect(flashcardHero.locator('[data-hero-kind-layer="bruin"][data-hero-slot="mascot"]'))
      .toHaveAttribute('display', null);
  });

  test('Card 1 (aggregation) shows its diagram in the question', async ({ page }) => {
    await page.goto(SEBOOK_URL);

    const container = page.locator('.flashcards-container[data-quiz-id="uml_class_diagram_examples"]');
    await expect(container).toBeVisible();

    // Cards are present in the DOM but only one is .active. Force card 1 active.
    await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '.flashcards-container[data-quiz-id="uml_class_diagram_examples"] .flashcard-card'
      );
      cards.forEach((c) => c.classList.remove('active'));
      const target = document.querySelector(
        '.flashcards-container[data-quiz-id="uml_class_diagram_examples"] .flashcard-card[data-card-id="1"]'
      );
      if (target) target.classList.add('active');
      if (window.UMLShared) window.UMLShared.renderAll();
    });

    const card1 = container.locator('.flashcard-card[data-card-id="1"]');
    const question = card1.locator('.flashcard-question');
    await expect(question).toContainText('following symbol');
    await expectRenderedUml(question);
  });

  test('Card 3 (composition vs aggregation) shows its diagram in the question', async ({ page }) => {
    await page.goto(SEBOOK_URL);

    const container = page.locator('.flashcards-container[data-quiz-id="uml_class_diagram_examples"]');
    await expect(container).toBeVisible();

    await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '.flashcards-container[data-quiz-id="uml_class_diagram_examples"] .flashcard-card'
      );
      cards.forEach((c) => c.classList.remove('active'));
      const target = document.querySelector(
        '.flashcards-container[data-quiz-id="uml_class_diagram_examples"] .flashcard-card[data-card-id="3"]'
      );
      if (target) target.classList.add('active');
      if (window.UMLShared) window.UMLShared.renderAll();
    });

    const card3 = container.locator('.flashcard-card[data-card-id="3"]');
    const question = card3.locator('.flashcard-question');
    await expect(question).toContainText('these two relationships');
    await expectRenderedUml(question);
  });
});

test.describe('UML class diagram flashcards - question diagrams render in SE Gym', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(
      context,
      'se-gym',
      JSON.stringify([{ type: 'flashcard', id: 'uml_class_diagram_examples' }])
    );
  });

  test('Question diagrams render whenever a card with one is active', async ({ page }) => {
    await page.goto(GYM_URL);

    // Run all 10 cards so we will encounter cards 1 and 3 regardless of shuffle.
    await page.locator('#max-cards').fill('10');
    await page.locator('#start-workout-btn').click();

    const flashcard = page.locator('.workout-flashcard');
    await expect(flashcard).toBeVisible();

    let sawAggregation = false;
    let sawComparison = false;

    for (let step = 0; step < 10; step++) {
      const question = flashcard.locator('.flashcard-question');
      const text = (await question.innerText()) || '';

      if (text.includes('following symbol') || text.includes('these two relationships')) {
        // The question references a visual — verify it's actually rendered.
        await expectRenderedUml(question);
        if (text.includes('following symbol')) sawAggregation = true;
        if (text.includes('these two relationships')) sawComparison = true;
      }

      await flashcard.locator('.show-answer-btn').click();
      await flashcard.locator('.correct-btn').click();

      // After the last card, the workout completes and the card disappears.
      if (step === 9) break;
      await expect(flashcard).toBeVisible();
    }

    expect(sawAggregation, 'Card 1 (aggregation) should appear in 10-card workout').toBe(true);
    expect(sawComparison, 'Card 3 (composition vs aggregation) should appear in 10-card workout').toBe(true);
  });
});
