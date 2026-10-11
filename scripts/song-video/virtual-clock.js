/*
 * Virtual clock for the Git song render stage.
 *
 * GitGraph (js/git-graph.js) animates with real timers — setTimeout and
 * requestAnimationFrame schedule its class changes, edge draw-ins, and
 * cleanup — on top of CSS transitions and keyframe animations. A video
 * frame has to show the graph at an exact moment, so the stage installs this
 * clock before git-graph.js loads and replaces those timer functions with
 * virtual ones that only run when the stage advances time:
 *
 *   VirtualClock.reset()              drops every pending callback; now = 0
 *   VirtualClock.advanceTo(ms, step)  runs every callback due up to `ms`, in
 *                                     due-time order, calling step(now) after
 *                                     each one
 *   VirtualClock.now()                the current virtual time in ms
 *
 * Animation frames tick at 60 Hz of virtual time. CSS animations are not
 * timers, so graph-track.js poses them itself (see stampAnimations there).
 * The stage never needs real timers after boot; the originals stay
 * available as VirtualClock.real for its loading code.
 */
(function () {
  'use strict';

  const FRAME_MS = 1000 / 60;

  const real = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  };

  let now = 0;
  let nextId = 1;
  let order = 0;
  const timers = new Map(); // id → { due, order, fn, args, interval }
  const frameCallbacks = new Map(); // id → fn

  function schedule(fn, delay, args, interval) {
    const id = nextId++;
    timers.set(id, { due: now + Math.max(0, Number(delay) || 0), order: order++, fn, args, interval });
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

  function runTimer({ id, timer }) {
    if (timer.interval) {
      timer.due += timer.interval;
      timer.order = order++;
    } else {
      timers.delete(id);
    }
    timer.fn.apply(window, timer.args);
  }

  function runFrame() {
    const callbacks = [...frameCallbacks.values()];
    frameCallbacks.clear();
    for (const callback of callbacks) callback(now);
  }

  function advanceTo(target, step) {
    for (;;) {
      const earliest = earliestTimer();
      const timerAt = earliest ? earliest.timer.due : Infinity;
      const frameAt = frameCallbacks.size ? (Math.floor(now / FRAME_MS + 1e-9) + 1) * FRAME_MS : Infinity;
      const at = Math.min(timerAt, frameAt);
      if (at > target) break;
      now = at;
      if (timerAt <= frameAt) runTimer(earliest);
      else runFrame();
      if (step) step(now);
    }
    now = Math.max(now, target);
  }

  function reset() {
    timers.clear();
    frameCallbacks.clear();
    now = 0;
  }

  window.setTimeout = (fn, delay, ...args) => schedule(fn, delay, args, null);
  window.setInterval = (fn, delay, ...args) => schedule(fn, delay, args, Math.max(1, Number(delay) || 0));
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    frameCallbacks.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => frameCallbacks.delete(id);

  window.VirtualClock = { advanceTo, reset, now: () => now, real };
})();
