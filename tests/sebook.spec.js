// @ts-check
const { test, expect } = require('@playwright/test');

async function expectNavLinkActive(page, targetId) {
  await expect
    .poll(async () => page.evaluate((href) => {
      const link = document.querySelector(`#navnav .navbar-nav a[href="${href}"]`);
      const item = link && link.closest('li');
      const linkClass = link ? link.className : '';
      const itemClass = item ? item.className : '';
      return /\bactive\b/.test(linkClass) || /\bactive\b/.test(itemClass);
    }, targetId), {
      timeout: 5000,
      message: `Expected nav link ${targetId} or its parent item to become active`
    })
    .toBe(true);
}

async function expectToggleRowVisible(page, toggleId, visible) {
  await expect
    .poll(async () => page.evaluate(({ id }) => {
      const input = document.getElementById(id);
      const row = input && input.closest('div');
      return row ? getComputedStyle(row).display : null;
    }, { id: toggleId }), {
      timeout: 5000,
      message: `Expected ${toggleId} row visibility to be ${visible}`
    })
    .toBe(visible ? 'flex' : 'none');
}

/**
 * Tests: SEBook Navigation Highlighting
 * 
 * Verifies that navigating within the SEBook (via links or scrolling)
 * correctly highlights the active category in the navbar.
 */

test.describe('SEBook Navigation Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a navbar link highlights the category', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Navbar should expose internal section links').toBeGreaterThan(2);

    const link = navLinks.nth(1);
    const targetId = await link.getAttribute('href');
    expect(targetId).toBeTruthy();

    await expect(page.locator(targetId), `Expected section ${targetId} to exist`).toHaveCount(1);
    await link.click();
    await expectNavLinkActive(page, targetId);
  });

  test('scrolling manually highlights the category', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Navbar should expose internal section links').toBeGreaterThan(2);

    const targetId = await navLinks.nth(2).getAttribute('href');
    expect(targetId).toBeTruthy();

    const section = page.locator(targetId);
    await expect(section, `Expected section ${targetId} to exist`).toHaveCount(1);

    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        const nav = document.getElementById('navnav');
        const navHeight = nav ? nav.offsetHeight : 50;
        const top = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - navHeight - 8));
      }
    }, targetId);

    await expectNavLinkActive(page, targetId);
  });
});

test.describe('SEBook page toggles', () => {
  test('dark mode toggle updates the document theme state', async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');

    await expectToggleRowVisible(page, 'darkModeToggle', true);
    await page.locator('#darkModeToggle').setChecked(true, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark-mode')))
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.cookie.includes('dark-mode=true')))
      .toBe(true);

    await page.locator('#darkModeToggle').setChecked(false, { force: true });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark-mode')))
      .toBe(false);
  });

  test('highlights toggle is shown only when marks exist and controls mark styling', async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');

    await expect(page.locator('#main-content mark').first()).toBeVisible();
    await expectToggleRowVisible(page, 'highlightToggle', true);

    await page.locator('#highlightToggle').setChecked(false, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('highlights-disabled')))
      .toBe(true);
    await expect
      .poll(() => page.locator('#main-content mark').first().evaluate((mark) => getComputedStyle(mark).backgroundColor))
      .toBe('rgba(0, 0, 0, 0)');

    await page.goto('/SEBook/uml.html');
    await expect(page.locator('#main-content mark')).toHaveCount(0);
    await expectToggleRowVisible(page, 'highlightToggle', false);
  });

  test('read-aloud toggle is shown only when audio players exist and controls player visibility', async ({ page }) => {
    await page.goto('/SEBook/process/scrum.html');

    await expect(page.locator('#main-content .cap').first()).toBeVisible();
    await expectToggleRowVisible(page, 'readAloudToggle', true);

    await page.locator('#readAloudToggle').setChecked(false, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('read-aloud-enabled')))
      .toBe(false);
    await expect
      .poll(() => page.locator('#main-content .cap').first().evaluate((player) => getComputedStyle(player).display))
      .toBe('none');

    await page.goto('/SEBook/uml.html');
    await expect(page.locator('#main-content .cap')).toHaveCount(0);
    await expectToggleRowVisible(page, 'readAloudToggle', false);
  });
});

/**
 * Tests: Read-aloud (Text-to-Speech) button
 *
 * The #tts-read-btn button reads the page aloud via the Web Speech API.
 * Two Chrome-specific bugs make a naive implementation silently fail:
 *  - speechSynthesis.speak() loses Chrome's transient user activation
 *    when invoked through setTimeout, so the utterance is dropped.
 *  - Chrome's TTS engine drops utterances longer than ~32K chars or that
 *    take longer than ~15s to speak.
 * These tests pin down both behaviors by mocking the Web Speech API.
 */
async function mockSpeechSynthesis(page) {
  await page.addInitScript(() => {
    const ttsLog = [];
    window.__ttsLog = ttsLog;

    function MockUtterance(text) {
      this.text = text;
      this.rate = 1;
      this.voice = null;
      this.lang = '';
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
      this.onboundary = null;
    }

    const mockSynth = {
      _speaking: false,
      _voices: [{ name: 'Mock Voice', lang: 'en-US', localService: true }],
      get speaking() { return this._speaking; },
      pending: false,
      paused: false,
      getVoices() { return this._voices; },
      addEventListener() {},
      removeEventListener() {},
      speak(utt) {
        ttsLog.push({ type: 'speak', text: utt.text });
        this._speaking = true;
        // Simulate the utterance lifecycle so chained chunks advance.
        setTimeout(() => {
          if (utt.onstart) utt.onstart();
          setTimeout(() => {
            mockSynth._speaking = false;
            if (utt.onend) utt.onend();
          }, 1);
        }, 0);
      },
      cancel() {
        ttsLog.push({ type: 'cancel' });
        this._speaking = false;
      },
      pause() { this.paused = true; },
      resume() { this.paused = false; }
    };

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      get() { return mockSynth; }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: MockUtterance
    });
  });
}

test.describe('SEBook read-aloud button (TTS)', () => {
  test('clicking the read-aloud button speaks the page text', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    await page.click('#tts-read-btn');

    await expect
      .poll(() => page.evaluate(() => window.__ttsLog.filter((l) => l.type === 'speak').length), {
        timeout: 5000,
        message: 'Expected speechSynthesis.speak() to be called when the read-aloud button is clicked'
      })
      .toBeGreaterThan(0);

    // Combined chunk text should reflect the page's main content.
    const speakCalls = await page.evaluate(() =>
      window.__ttsLog.filter((l) => l.type === 'speak').map((l) => l.text)
    );
    expect(speakCalls.join(' ').toLowerCase()).toContain('testing');
  });

  test('regression: speak() runs synchronously from click to preserve Chrome user activation', async ({ page }) => {
    // Chrome silently aborts speak() when its transient user activation has
    // expired. The previous implementation deferred speak() through a
    // setTimeout(50ms), which loses the activation and produces no audio in
    // Chrome. Verify speak() is dispatched synchronously inside the click
    // handler, before the click event finishes propagating.
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    const speakCountAfterSyncClick = await page.evaluate(() => {
      window.__ttsLog.length = 0;
      document.getElementById('tts-read-btn').click();
      return window.__ttsLog.filter((l) => l.type === 'speak').length;
    });

    expect(speakCountAfterSyncClick).toBeGreaterThan(0);
  });

  test('regression: long page text is chunked to work around Chrome long-utterance silent-fail', async ({ page }) => {
    // Chrome's speech engine drops utterances over ~32K chars and stops
    // speaking after ~15s. Long pages like /SEBook/tools/shell trigger this:
    // a single speak() call produces no audio. The fix splits the text into
    // short chunks and chains them via onend.
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    await page.evaluate(() => {
      window.__ttsLog.length = 0;
      let longText = '';
      const sentence = 'This is a sample sentence used to exercise the chunker. ';
      while (longText.length < 5000) longText += sentence;
      window.TTSPlayer.speak(longText);
    });

    await expect
      .poll(() => page.evaluate(() => window.__ttsLog.filter((l) => l.type === 'speak').length), {
        timeout: 5000,
        message: 'Long text should be split across multiple speak() calls'
      })
      .toBeGreaterThan(1);

    const speakCalls = await page.evaluate(() =>
      window.__ttsLog.filter((l) => l.type === 'speak')
    );
    for (const call of speakCalls) {
      // A small slack over MAX_CHUNK_LENGTH (200) covers the trailing
      // sentence-boundary string that the chunker keeps with its piece.
      expect(call.text.length).toBeLessThanOrEqual(300);
    }
  });
});
