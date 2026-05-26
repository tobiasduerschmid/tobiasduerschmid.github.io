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
    await expect(page.locator('#navnav .navbar-nav a[href^="#"]').first()).toBeVisible();
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

test.describe('SEBook sidebar navigation', () => {
  test('renders the current sidebar branch without client-side correction', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      await page.goto('/SEBook/designpatterns/facade.html');

      const sidebarNav = page.getByRole('navigation', { name: 'SE Book table of contents' });
      const currentLink = sidebarNav.getByRole('link', { name: 'Facade' });
      const topicToggle = sidebarNav.getByRole('button', { name: 'Toggle Design Patterns subtopics' });

      await expect(currentLink).toBeVisible();
      await expect(currentLink).toHaveAttribute('aria-current', 'page');
      await expect(topicToggle).toHaveAttribute('aria-expanded', 'true');
    } finally {
      await context.close();
    }
  });

  test('opens and closes a sidebar section with its accessible toggle', async ({ page }) => {
    await page.goto('/SEBook/designpatterns/facade.html');

    const sidebarNav = page.getByRole('navigation', { name: 'SE Book table of contents' });
    const topicToggle = sidebarNav.getByRole('button', { name: 'Toggle Design Patterns subtopics' });
    const currentLink = sidebarNav.getByRole('link', { name: 'Facade' });

    await expect(currentLink).toHaveAttribute('aria-current', 'page');
    await expect(topicToggle).toHaveAttribute('aria-expanded', 'true');

    await topicToggle.click();
    await expect(topicToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(currentLink).toBeHidden();

    await topicToggle.click();
    await expect(topicToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(currentLink).toBeVisible();
  });

  test('marks one current sidebar link and distinguishes it from sibling links across depths', async ({ page }) => {
    await page.goto('/SEBook/designpatterns/builder.html');

    let sidebarNav = page.getByRole('navigation', { name: 'SE Book table of contents' });
    let currentLinks = sidebarNav.locator('a[aria-current="page"]');
    let currentLink = sidebarNav.getByRole('link', { name: 'Builder' });
    let siblingLink = sidebarNav.getByRole('link', { name: 'Composite' });

    await expect(currentLinks).toHaveCount(1);
    await expect(currentLink).toHaveAttribute('aria-current', 'page');
    await expect(siblingLink).not.toHaveAttribute('aria-current', 'page');

    let currentBackground = await currentLink.evaluate((link) => getComputedStyle(link).backgroundColor);
    let siblingBackground = await siblingLink.evaluate((link) => getComputedStyle(link).backgroundColor);
    expect(currentBackground, 'current subtopic should use a distinct highlight background')
      .not.toBe(siblingBackground);

    await page.goto('/SEBook/quality_attributes/interoperability.html');

    sidebarNav = page.getByRole('navigation', { name: 'SE Book table of contents' });
    currentLinks = sidebarNav.locator('a[aria-current="page"]');
    currentLink = sidebarNav.getByRole('link', { name: 'Interoperability' });
    siblingLink = sidebarNav.getByRole('link', { name: 'Testability' });

    await expect(currentLinks).toHaveCount(1);
    await expect(currentLink).toHaveAttribute('aria-current', 'page');
    await expect(siblingLink).not.toHaveAttribute('aria-current', 'page');

    currentBackground = await currentLink.evaluate((link) => getComputedStyle(link).backgroundColor);
    siblingBackground = await siblingLink.evaluate((link) => getComputedStyle(link).backgroundColor);
    expect(currentBackground, 'current nested item should use a distinct highlight background')
      .not.toBe(siblingBackground);
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
    await page.goto('/blog/evidence-based-study-tips-for-college-students/');

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
    // short chunks and queues them up front.
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
      // A small slack over MAX_CHUNK_LENGTH (180) covers the trailing
      // sentence-boundary string that the chunker keeps with its piece.
      expect(call.text.length).toBeLessThanOrEqual(260);
    }
  });

  test('regression: all chunks are queued up front (no chain-via-onend gap)', async ({ page }) => {
    // Chrome's TTS engine inserts a perceptible (~200-400ms) gap between
    // utterances when each one is enqueued from the previous one's onend
    // handler. Queueing every chunk before the first one starts shrinks
    // the gap to the engine's internal queue-processing latency. This test
    // verifies that all speak() calls happen synchronously inside the
    // initial speak() invocation — i.e. before any onend callback fires.
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    const counts = await page.evaluate(() => {
      window.__ttsLog.length = 0;
      // Build text long enough to need many chunks (≥5).
      let text = '';
      const filler = 'Sentence ending in a period. ';
      while (text.length < 2000) text += filler;
      // Synchronously call speak() and immediately read the log.
      window.TTSPlayer.speak(text);
      const synchronous = window.__ttsLog.filter((l) => l.type === 'speak').length;
      return { synchronous, totalLen: text.length };
    });

    // All chunks must have been queued before the inner evaluate function
    // returns. With the old chain-via-onend pattern only the first chunk
    // would be present synchronously.
    expect(counts.synchronous).toBeGreaterThan(4);
  });
});

/**
 * Tests: TTS pacing improvements
 *
 * Plain textContent extraction concatenates blocks with no boundaries, so
 * "Software TestingIn our quest..." reads as one phrase and the chunker's
 * word-boundary fallback creates audible pauses mid-sentence. The DOM-aware
 * extractor injects ". " at block exits and ", " at list / cell exits,
 * giving the chunker plenty of natural breakpoints and giving the speech
 * engine room to insert real intonation.
 */
test.describe('SEBook read-aloud pacing', () => {
  test('extract() inserts a strong pause after headings', async ({ page }) => {
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer);

    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML = '<h1>Title</h1><p>Body sentence</p><h2>Section</h2><p>More body</p>';
      return window.TTSPlayer.extract(div);
    });

    expect(result.text).toMatch(/Title\.\s+Body sentence\./);
    expect(result.text).toMatch(/Section\.\s+More body/);
  });

  test('extract() inserts pauses at code-line and blockquote boundaries', async ({ page }) => {
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer);

    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML =
        '<pre>line one\nline two\nline three</pre>' +
        '<blockquote>A quoted aside</blockquote>' +
        '<p>Final paragraph</p>';
      return window.TTSPlayer.extract(div).text;
    });

    // Each code line stands alone as a sentence so the engine pauses at line breaks.
    expect(result).toMatch(/line one\.\s+line two\.\s+line three\./);
    // Leaving the blockquote marks a strong pause before the next paragraph.
    expect(result).toMatch(/A quoted aside\.\s+Final paragraph/);
  });

  test('extract() collapses double punctuation injected by adjacent blocks', async ({ page }) => {
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer);

    const text = await page.evaluate(() => {
      const div = document.createElement('div');
      // Each <p> already ends with a period — the extractor must not produce ".."
      div.innerHTML = '<p>First.</p><p>Second.</p><p>Third.</p>';
      return window.TTSPlayer.extract(div).text;
    });

    expect(text).not.toMatch(/\.\./);
    expect(text).toMatch(/First\.\s+Second\.\s+Third\./);
  });

  test('regression: chunker prefers sentence boundaries over word boundaries', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    // Build text where the same window contains both a sentence boundary
    // and several word boundaries. The chunker must end every chunk at a
    // sentence/clause boundary, not in the middle of a word.
    const speakCalls = await page.evaluate(() => {
      window.__ttsLog.length = 0;
      let text = '';
      const filler = 'Word ';
      // Build long stretches of words punctuated by full stops.
      for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 15; j++) text += filler;
        text += 'End. ';
      }
      window.TTSPlayer.speak(text);
      return null;
    });

    await expect
      .poll(() => page.evaluate(() => window.__ttsLog.filter((l) => l.type === 'speak').length))
      .toBeGreaterThan(1);

    const calls = await page.evaluate(() =>
      window.__ttsLog.filter((l) => l.type === 'speak').map((l) => l.text)
    );
    // Every chunk except possibly the last (the tail) must terminate on a
    // sentence-ending pause. A chunk ending with "Word " is a Tier-3 split
    // and produces an audible mid-sentence pause.
    for (let i = 0; i < calls.length - 1; i++) {
      expect(calls[i]).toMatch(/[.!?]\s*$/);
    }
  });
});

/**
 * Tests: TTS navigation controls
 *
 * Co-designed with the structured extractor: heading positions recorded
 * during extraction power both the extra strong pause (pacing) and the
 * prev/next-heading buttons (navigation). 10-second skips use a
 * rate-aware chars-per-second estimate so the perceived skip feels the
 * same regardless of playback speed.
 */
test.describe('SEBook read-aloud navigation', () => {
  test('extract() records a marker for every heading', async ({ page }) => {
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer);

    const markers = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML =
        '<h1>Alpha</h1><p>body alpha</p>' +
        '<h2>Bravo</h2><p>body bravo</p>' +
        '<h3>Charlie</h3><p>body charlie</p>';
      return window.TTSPlayer.extract(div).markers;
    });

    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.label)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(markers.map((m) => m.level)).toEqual([1, 2, 3]);
    // Markers are ordered by document position.
    expect(markers[0].offset).toBeLessThan(markers[1].offset);
    expect(markers[1].offset).toBeLessThan(markers[2].offset);
  });

  test('seekToHeading("next") jumps offset to the next heading marker', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    const result = await page.evaluate(async () => {
      const div = document.createElement('div');
      div.innerHTML =
        '<h1>Alpha</h1><p>body alpha sentence here</p>' +
        '<h2>Bravo</h2><p>body bravo sentence here</p>';
      const extracted = window.TTSPlayer.extract(div);
      window.__ttsLog.length = 0;
      window.TTSPlayer.speak(extracted);
      // Allow the first chunk to be queued.
      await new Promise((r) => setTimeout(r, 5));
      window.TTSPlayer.seekToHeading('next');
      await new Promise((r) => setTimeout(r, 100));
      const lastSpeak = window.__ttsLog.filter((l) => l.type === 'speak').slice(-1)[0];
      return { lastChunk: lastSpeak ? lastSpeak.text : null, bravoOffset: extracted.markers.find((m) => m.label === 'Bravo').offset };
    });

    // After seeking to "Bravo", the chunk being spoken must start at or
    // after the Bravo heading position — i.e., contain "Bravo" near its head.
    expect(result.lastChunk).toBeTruthy();
    expect(result.lastChunk).toContain('Bravo');
  });

  test('regression: seekToHeading("next") advances from the current playback position, not from 0', async ({ page }) => {
    // Bug: in the chained-via-onend implementation, chunk onstart only set
    // _speaking=true; it did not update _offset. _offset only progressed
    // via onboundary events, which Chrome fires unreliably for some voices,
    // so _offset stayed near 0 throughout playback. Every "next heading"
    // click then jumped to whichever heading sat just past offset 0 —
    // i.e. the same heading every time. The fix updates _offset on each
    // chunk's onstart (and again on its onend so the inter-chunk gap is
    // also covered).
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    const result = await page.evaluate(() => {
      // Three headings spaced apart by long word-only paragraphs so the
      // chunker produces several chunks between consecutive headings.
      const div = document.createElement('div');
      div.innerHTML =
        '<h1>One</h1><p>' + 'word '.repeat(120) + '</p>' +
        '<h2>Two</h2><p>' + 'word '.repeat(120) + '</p>' +
        '<h3>Three</h3><p>' + 'word '.repeat(120) + '</p>';
      const extracted = window.TTSPlayer.extract(div);
      const T = window.TTSPlayer;

      T.speak(extracted);
      // Move offset forward enough to land between headings One and Two.
      // This deterministically simulates "playback progressed past the first
      // heading" without depending on async onstart timing.
      T.seekRelative(45);
      const offsetBeforeNext = T.getProgress() * extracted.text.length;

      // From a position past One, "next heading" must jump to Two — not One.
      window.__ttsLog.length = 0;
      T.seekToHeading('next');
      const calls = window.__ttsLog.filter((l) => l.type === 'speak');
      const firstChunk = calls[0] ? calls[0].text : null;

      return { firstChunk, offsetBeforeNext, headingOffsets: extracted.markers.map((m) => ({ label: m.label, offset: m.offset })) };
    });

    // Sanity: seekRelative actually advanced past the first heading.
    expect(result.headingOffsets[0].offset).toBeLessThan(result.offsetBeforeNext);
    // The post-seek chunk should start with content from heading "Two" or
    // later, never with "One" (the previous heading we already passed).
    expect(result.firstChunk).toBeTruthy();
    expect(result.firstChunk).not.toMatch(/^One/);
    expect(result.firstChunk).toMatch(/^Two|^Three/);
  });

  test('seekToHeading("prev") rewinds to the start when before the first heading', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    // After speaking is in flight, asking "prev" from a position before all
    // headings rewinds to offset 0 rather than no-oping.
    const result = await page.evaluate(async () => {
      const div = document.createElement('div');
      // First heading is at offset > 0 because some prefix prose precedes it.
      div.innerHTML = '<p>Intro before any heading.</p><h1>FirstHeading</h1><p>body</p>';
      const extracted = window.TTSPlayer.extract(div);
      window.__ttsLog.length = 0;
      window.TTSPlayer.speak(extracted);
      await new Promise((r) => setTimeout(r, 5));
      // Force offset past the first heading by advancing it.
      window.TTSPlayer.seekToHeading('next');
      await new Promise((r) => setTimeout(r, 30));
      window.TTSPlayer.seekToHeading('prev');
      await new Promise((r) => setTimeout(r, 100));
      const firstSpeak = window.__ttsLog.filter((l) => l.type === 'speak').slice(-1)[0];
      return firstSpeak ? firstSpeak.text : null;
    });

    expect(result).toBeTruthy();
    // After prev with no preceding heading, playback resumes at the start.
    expect(result).toMatch(/^Intro/);
  });

  test('seekRelative jumps offset proportional to the rate', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    const probe = await page.evaluate(() => {
      // 10K chars of neutral text so progress is measurable in fractions.
      const text = 'word '.repeat(2000);
      const T = window.TTSPlayer;

      T.speak(text, { rate: 1.0 });
      const startProgress = T.getProgress();
      T.seekRelative(10);
      const after1xForward = T.getProgress();

      T.stop();
      T.speak(text, { rate: 2.0 });
      T.seekRelative(10);
      const after2xForward = T.getProgress();

      T.stop();
      T.speak(text, { rate: 1.0 });
      T.seekRelative(10);
      T.seekRelative(-10);
      const afterRoundTrip = T.getProgress();

      return { startProgress, after1xForward, after2xForward, afterRoundTrip };
    });

    // Forward seek moves progress strictly forward.
    expect(probe.startProgress).toBe(0);
    expect(probe.after1xForward).toBeGreaterThan(0);
    // 2x rate covers about twice as much text per "10s" — at minimum strictly
    // more than the 1x case (we don't pin an exact ratio because the formula
    // is heuristic).
    expect(probe.after2xForward).toBeGreaterThan(probe.after1xForward);
    // Forward then back lands back at the start (clamped at 0).
    expect(probe.afterRoundTrip).toBe(0);
  });

  test('TTS bar exposes navigation buttons; heading buttons appear when the page has headings', async ({ page }) => {
    await mockSpeechSynthesis(page);
    await page.goto('/SEBook/testing.html');
    await page.waitForFunction(() => window.TTSPlayer && window.TTSPlayer.isSupported());

    // Always-visible nav buttons exist in the markup.
    await expect(page.locator('#tts-back-10s')).toHaveCount(1);
    await expect(page.locator('#tts-fwd-10s')).toHaveCount(1);
    await expect(page.locator('#tts-prev-heading')).toHaveCount(1);
    await expect(page.locator('#tts-next-heading')).toHaveCount(1);

    // Trigger reading; testing.html has multiple headings so the heading
    // buttons should reveal themselves.
    await page.click('#tts-read-btn');
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.getElementById('tts-prev-heading');
        return el ? getComputedStyle(el).display : 'missing';
      }))
      .not.toBe('none');
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.getElementById('tts-next-heading');
        return el ? getComputedStyle(el).display : 'missing';
      }))
      .not.toBe('none');
  });
});
