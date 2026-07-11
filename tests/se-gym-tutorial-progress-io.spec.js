// @ts-check
const { test, expect } = require('@playwright/test');

const GYM_URL = '/se-gym/';

function progressFile(payload) {
  return {
    name: 'tutorial-progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  };
}

async function uploadProgress(page, payload) {
  await page.locator('#upload-tutorial-progress-input').setInputFiles(progressFile(payload));
}

test.describe('SE Gym tutorial progress import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GYM_URL);
    await page.evaluate(() => localStorage.clear());
  });

  test('rejects entries outside the tutorial-progress storage namespace', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('se-gym-stats', 'keep-me'));

    await uploadProgress(page, {
      format: 'se-gym-tutorial-progress',
      version: 1,
      entries: {
        'se-gym-stats': { value: { attackerControlled: true } },
      },
    });

    await expect(page.locator('#tutorial-progress-status')).toContainText('invalid tutorial entry');
    await expect(page.locator('#tutorial-import-modal')).toHaveClass(/is-hidden/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('se-gym-stats'))).toBe('keep-me');
  });

  test('rejects unsupported export versions before showing import choices', async ({ page }) => {
    await uploadProgress(page, {
      format: 'se-gym-tutorial-progress',
      version: 2,
      entries: {
        'tutorial-progress-python': { value: { step: 2, files: {} } },
      },
    });

    await expect(page.locator('#tutorial-progress-status')).toContainText('not a supported tutorial-progress export');
    await expect(page.locator('#tutorial-import-modal')).toHaveClass(/is-hidden/);
  });

  test('imports a valid versioned tutorial progress entry', async ({ page }) => {
    const value = { step: 2, files: {}, activeFile: 'main.py', stepsUnlocked: [0, 1, 2] };
    await uploadProgress(page, {
      format: 'se-gym-tutorial-progress',
      version: 1,
      entries: {
        'tutorial-progress-python': { title: 'Python', value },
      },
    });

    await expect(page.locator('#tutorial-import-modal')).not.toHaveClass(/is-hidden/);
    await page.locator('#tutorial-import-confirm').click();

    await expect(page.locator('#tutorial-progress-status')).toHaveText('Imported progress for 1 tutorial.');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-python')))).toEqual(value);
  });
});
