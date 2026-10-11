/*
 * Scoped deterministic scheduler for song graphs. create() owns one queue;
 * loading this module never replaces browser timers. advanceTo(ms, step)
 * runs due callbacks on a 60 Hz frame grid, then leaves time at exactly ms.
 * Reset before rewinding. CSS/Web Animations are posed by GraphTrack.
 */
(function () {
  'use strict';

  const FRAME_MS = 1000 / 60;

  function create() {
    let now = 0;
    let nextId = 1;
    let order = 0;
    const timers = new Map();
    const frames = new Map();

    function setTimeout(fn, delay, ...args) {
      const id = nextId++;
      timers.set(id, { due: now + Math.max(0, Number(delay) || 0), order: order++, fn, args });
      return id;
    }

    function earliestTimer() {
      let earliest = null;
      for (const [id, timer] of timers) {
        if (!earliest || timer.due < earliest.timer.due ||
            (timer.due === earliest.timer.due && timer.order < earliest.timer.order)) {
          earliest = { id, timer };
        }
      }
      return earliest;
    }

    function runFrame() {
      // Snapshot only IDs: cancellation by an earlier callback in this frame
      // still prevents a later callback; newly requested frames wait a tick.
      for (const id of [...frames.keys()]) {
        const callback = frames.get(id);
        frames.delete(id);
        if (callback) callback(now);
      }
    }

    function advanceTo(target, step) {
      for (;;) {
        const earliest = earliestTimer();
        const timerAt = earliest ? earliest.timer.due : Infinity;
        const frameAt = frames.size ? (Math.floor(now / FRAME_MS + 1e-9) + 1) * FRAME_MS : Infinity;
        const at = Math.min(timerAt, frameAt);
        if (at > target) break;
        now = at;
        if (timerAt <= frameAt) {
          timers.delete(earliest.id);
          earliest.timer.fn(...earliest.timer.args);
        } else {
          runFrame();
        }
        if (step) step(now);
      }
      now = Math.max(now, target);
    }

    return {
      setTimeout,
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame: (fn) => {
        const id = nextId++;
        frames.set(id, fn);
        return id;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      advanceTo,
      now: () => now,
      reset: () => { timers.clear(); frames.clear(); now = 0; },
    };
  }

  window.VirtualClock = { create };
})();
