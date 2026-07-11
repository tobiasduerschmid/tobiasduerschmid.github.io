// @ts-check
const { test, expect } = require('@playwright/test');

async function createManager(page, pathname) {
  await page.addScriptTag({ url: '/js/tutorial-popout-manager.js' });
  return page.evaluate((path) => {
    window.__popoutNextRequests = 0;
    window.__popoutProbeComplete = false;
    window.__popoutManager = new window.TutorialPopoutManager({
      tutorialId: 'session-test',
      pathname: path,
      hooks: {
        onNextStepRequest: () => { window.__popoutNextRequests += 1; },
        onSaveFileRequest: () => { window.__popoutProbeComplete = true; },
      },
    });
    window.__popoutManager.init();
    return {
      channelName: window.__popoutManager.channelName,
      sessionId: window.__popoutManager.sessionId,
      storageKey: window.__popoutManager.storageKey,
    };
  }, pathname);
}

test('same-tutorial tabs use distinct popout sessions while reload reuses its own session', async ({ context, page }) => {
  const pathname = '/SEBook/tools/session-test-tutorial';
  await page.goto('/cookies/');
  const first = await createManager(page, pathname);

  const secondPage = await context.newPage();
  await secondPage.goto('/cookies/');
  const second = await createManager(secondPage, pathname);

  expect(second.sessionId).not.toBe(first.sessionId);
  expect(second.channelName).not.toBe(first.channelName);
  expect(second.storageKey).not.toBe(first.storageKey);

  await page.reload();
  const afterReload = await createManager(page, pathname);
  expect(afterReload.sessionId).toBe(first.sessionId);
  expect(afterReload.channelName).toBe(first.channelName);
});

test('manager rejects messages carrying another tab session', async ({ page }) => {
  const pathname = '/SEBook/tools/session-message-test';
  await page.goto('/cookies/');
  const manager = await createManager(page, pathname);

  await page.evaluate(({ channelName, sessionId }) => {
    const sender = new BroadcastChannel(channelName);
    sender.postMessage({
      type: 'request-next-step',
      sourceId: 'other-tab',
      sessionId: sessionId + '-wrong',
    });
    sender.postMessage({
      type: 'request-next-step',
      sourceId: 'own-popup',
      sessionId,
    });
    sender.postMessage({
      type: 'request-save',
      sourceId: 'own-popup',
      sessionId,
      filename: 'probe.txt',
    });
    window.setTimeout(() => sender.close(), 50);
  }, manager);
  await expect.poll(() => page.evaluate(() => window.__popoutProbeComplete)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__popoutNextRequests)).toBe(1);
});
