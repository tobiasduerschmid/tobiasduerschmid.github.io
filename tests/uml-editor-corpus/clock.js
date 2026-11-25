'use strict';
/**
 * Time for the UML editor's gesture corpus and style evidence (spec 2026-11-12 §9.2: the clock is
 * controlled, no fixed waits). The page's clock is installed before navigation and paused, so no
 * timer of the editor fires unless a gesture or the harness advances it. Every window below is the
 * editor's own (`_includes/uml-editor.html`); the harness advances past them explicitly.
 */

// A fixed instant, so Date.now() and every timer start from the same time in every run.
const START_TIME = Date.UTC(2026, 10, 12, 9, 0, 0);
const PAUSED_AT = START_TIME + 1000;

const WINDOWS = Object.freeze({
  renderDebounceMs: 120, // LIVE_RENDER_DEBOUNCE_MS: typing renders after this
  visualEditorIdleMs: 160, // scheduleVisualEditorInstall: requestIdleCallback timeout
  autosaveDelayMs: 250, // scheduleAutosave
  doubleClickMs: 500, // lastHitboxClick and lastRouteClick
  undoCoalesceMs: 600, // COALESCE_MS of snapshotForUndo
  savedIndicatorMs: 1400, // showSavedIndicator clears "✓ Saved"
  statusClearMs: 2000, // the longest status line that clears itself
  undoCoalesceCapMs: 3000, // MAX_COALESCE_MS of snapshotForUndo
});

// After a gesture: past the render debounce, the deferred hit-layer install, and the autosave
// delay, and before the saved indicator clears, so a stored draft and "✓ Saved" can be observed.
const SETTLE_MS = WINDOWS.autosaveDelayMs + 50;
// Before a gesture, an Undo, or a Redo: past the coalescing cap and every self-clearing indicator,
// so no step joins the undo burst of the step before it.
const QUIET_MS = WINDOWS.undoCoalesceCapMs + 500;

/** Installs the fake clock on the page's context and pauses it; call before navigation. */
async function installPausedClock(page) {
  await page.clock.install({ time: START_TIME });
  await page.clock.pauseAt(PAUSED_AT);
}

/** Runs the editor's timers that fall due within `ms` of fake time, in order. */
async function advance(page, ms) {
  await page.clock.runFor(ms);
}

async function settle(page) {
  await advance(page, SETTLE_MS);
}

async function quiesce(page) {
  await advance(page, QUIET_MS);
}

module.exports = { START_TIME, WINDOWS, SETTLE_MS, QUIET_MS, installPausedClock, advance, settle, quiesce };
