const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

for (const fullscreen of [false, true]) {
  test(`mobile workout starts and scrolls to each question (fullscreen preference ${fullscreen})`, async ({ page, context, baseURL }) => {
    const errors = [];
    const gymScripts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/js/se-gym.js') gymScripts.push(url);
    });
    // A phone/browser without the Fullscreen API must still start the workout.
    await page.addInitScript(() => { Element.prototype.requestFullscreen = undefined; });
    await context.addCookies([
      { name: 'se-gym-active', value: 'true', url: baseURL },
      { name: 'se-gym', value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'user_stories' }])), url: baseURL },
      { name: 'se-gym-workout-fullscreen', value: String(fullscreen), url: baseURL },
    ]);
    await page.goto('/se-gym/');
    // The HTML and API script must share a deployment-specific cache key.
    expect(gymScripts.length).toBeGreaterThan(0);
    for (const script of gymScripts) expect(script.searchParams.get('v')).toMatch(/^\d+$/);
    expect(new Set(gymScripts.map(script => script.href)).size).toBe(1);
    await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
    const card = page.locator('.workout-quiz-card').filter({ visible: true });
    const answerOptions = card.getByRole('group', { name: 'Answer options', exact: true })
      .or(card.getByRole('radiogroup', { name: 'Answer options', exact: true }));
    async function expectQuestionAtTop() {
      await expect(answerOptions).toBeVisible();
      await expect.poll(async () => {
        const question = await card.boundingBox();
        const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
        return Math.abs(question.y - (nav.y + nav.height + 10));
      }).toBeLessThan(4);
    }
    await expectQuestionAtTop();
    const needsSubmit = await answerOptions.getByRole('checkbox').count() > 0;
    await answerOptions.getByRole('checkbox').or(answerOptions.getByRole('radio')).first().tap();
    if (needsSubmit) await page.getByRole('button', { name: 'Submit Answer', exact: true }).tap();
    await page.getByRole('button', { name: 'Next', exact: true }).tap();
    await expectQuestionAtTop();
    expect(errors).toEqual([]);
  });
}
