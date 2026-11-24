// @ts-check

/**
 * Replace the Web Speech API's engine before page scripts load. Headless
 * browsers have no dependable voices, so this engine keeps "reading" the
 * queued text until it is cancelled, like a long lesson read aloud.
 * `window.speechSynthesis.speaking` reports whether reading is in progress.
 * @param {import('@playwright/test').Page} page
 */
async function installSpeechEngine(page) {
  await page.addInitScript(() => {
    const queue = [];
    const engine = {
      get speaking() { return queue.length > 0; },
      pending: false,
      paused: false,
      getVoices: () => [],
      addEventListener() {},
      removeEventListener() {},
      speak(utterance) {
        queue.push(utterance);
        if (queue.length === 1) setTimeout(() => utterance.onstart && utterance.onstart());
      },
      cancel() { queue.length = 0; },
      pause() { this.paused = true; },
      resume() { this.paused = false; },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => engine });
  });
}

module.exports = { installSpeechEngine };
