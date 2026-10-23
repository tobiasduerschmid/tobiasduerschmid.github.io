/*
 * Timeline for the song-video render stage: every visual is a pure function
 * of the song time t, so render.js can capture frames in any order.
 *
 *   Timeline.tween(node, keyframes, at, duration, easing)
 *       a paused Web Animation that runs from `at` (seconds) for `duration`
 *       and then holds its end state; one keyframe object animates from
 *       whatever lower-priority animations left behind, which is how exits
 *       continue from where entrances ended
 *   Timeline.onFrame(update)   a per-frame function of t
 *   Timeline.seek(t)           poses everything at time t
 *   Timeline.fx                common entrances, exits, and hits
 *   Timeline.beats             the song's beat grid (configure() sets it)
 *   Timeline.camera            punch-ins and shakes for the camera layer
 */
(function () {
  'use strict';

  const EASE = {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    in: 'cubic-bezier(0.7, 0, 0.84, 0)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    back: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    linear: 'linear',
  };

  const animations = [];
  const beforeFrame = [];
  const updaters = [];
  const disposers = [];

  function tween(node, keyframes, at, duration, easing = EASE.out) {
    const animation = node.animate(keyframes, {
      delay: at * 1000,
      duration: Math.max(1, duration * 1000),
      easing,
      fill: 'forwards',
    });
    animation.pause();
    animations.push(animation);
    return animation;
  }

  function onFrame(update) {
    updaters.push(update);
  }

  // Visibility must be resolved after posing Web Animations, before graph
  // renderers and other frame callbacks measure their newly visible artwork.
  function onBeforeFrame(update) {
    beforeFrame.push(update);
  }

  function seek(t) {
    for (const animation of animations) animation.currentTime = t * 1000;
    for (const update of beforeFrame) update(t);
    for (const update of updaters) update(t);
  }

  function onDispose(disposeResource) {
    disposers.push(disposeResource);
  }

  function dispose() {
    for (const animation of animations) animation.cancel();
    for (const release of disposers) release();
    animations.length = 0;
    beforeFrame.length = 0;
    updaters.length = 0;
    disposers.length = 0;
    cameraHits.length = 0;
  }

  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const progress = (t, at, duration) => clamp((t - at) / duration, 0, 1);
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  /** Deterministic pseudo-random number in [0, 1) for an integer seed. */
  function hash01(seed) {
    let x = (seed | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  const fx = {
    pop(node, at, { from = 0.4, duration = 0.42, rotate = 0 } = {}) {
      tween(node, [
        { opacity: 0, scale: from, rotate: `${rotate - 8}deg` },
        { opacity: 1, scale: 1, rotate: `${rotate}deg` },
      ], at, duration, EASE.back);
    },
    slam(node, at, { from = 2.4, duration = 0.32, rotate = 0 } = {}) {
      tween(node, [
        { opacity: 0, scale: from, rotate: `${rotate + 6}deg` },
        { opacity: 1, scale: 1, rotate: `${rotate}deg` },
      ], at, duration, EASE.out);
    },
    rise(node, at, { distance = 30, duration = 0.45 } = {}) {
      tween(node, [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }], at, duration);
    },
    slideIn(node, at, { dx = 60, dy = 0, duration = 0.45 } = {}) {
      tween(node, [{ opacity: 0, translate: `${dx}px ${dy}px` }, { opacity: 1, translate: '0 0' }], at, duration);
    },
    fadeIn(node, at, duration = 0.3) {
      tween(node, [{ opacity: 0 }, { opacity: 1 }], at, duration, EASE.inOut);
    },
    fadeOut(node, at, duration = 0.3) {
      tween(node, { opacity: 0 }, at, duration, EASE.in);
    },
    exit(node, at, { dx = -50, dy = 0, duration = 0.3 } = {}) {
      tween(node, { opacity: 0, translate: `${dx}px ${dy}px` }, at, duration, EASE.in);
    },
    popOut(node, at, duration = 0.25) {
      tween(node, { opacity: 0, scale: 0.6 }, at, duration, EASE.in);
    },
    /** Moves an absolutely positioned node by (dx, dy) relative to its CSS position. */
    moveTo(node, at, dx, dy, duration = 0.5, easing = EASE.inOut) {
      tween(node, { translate: `${dx}px ${dy}px` }, at, duration, easing);
    },
    draw(path, at, duration = 0.4) {
      path.setAttribute('pathLength', '1');
      tween(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], at, duration, EASE.inOut);
    },
    /** A quick squash-and-stretch hit on something already visible. */
    bump(node, at, amount = 0.12) {
      tween(node, [{ scale: 1 }, { scale: 1 + amount }, { scale: 1 }], at, 0.32, EASE.out);
    },
  };

  // ------------------------------------------------------------------
  // Beat grid
  // ------------------------------------------------------------------

  /**
   * A fixed grid (bpm, first) or, when the storyboard lists `times` (every
   * beat of a take whose tempo drifts), a tempo map; outside the map it
   * continues at its edge tempo.
   */
  const beats = {
    period: 60 / 95,
    first: 0,
    times: null,
    configure({ bpm, first, times }) {
      this.period = 60 / bpm;
      this.first = first;
      this.times = Array.isArray(times) && times.length > 1 ? times : null;
    },
    /** Time of beat i. */
    time(i) {
      const map = this.times;
      if (!map) return this.first + i * this.period;
      if (i < 0) return map[0] + i * (map[1] - map[0]);
      const last = map.length - 1;
      if (i > last) return map[last] + (i - last) * (map[last] - map[last - 1]);
      return map[i];
    },
    /** Index of the last beat at or before t (−1 before the first beat). */
    index(t) {
      const map = this.times;
      if (!map) return Math.floor((t - this.first) / this.period + 1e-9);
      if (t < map[0]) return -1;
      const last = map.length - 1;
      if (t >= map[last]) return last + Math.floor((t - map[last]) / (map[last] - map[last - 1]) + 1e-9);
      let lo = 0;
      let hi = last;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (map[mid] <= t + 1e-9) lo = mid;
        else hi = mid;
      }
      return lo;
    },
    /** Where t falls in its beat: { index, phase in [0, 1), period }. */
    at(t) {
      const index = this.index(t);
      const begin = this.time(index);
      const period = this.time(index + 1) - begin;
      return { index, phase: Math.min(0.999999, Math.max(0, (t - begin) / period)), period };
    },
    /** 1 on a beat, decaying exponentially until the next one. */
    pulse(t, decay = 0.11) {
      const i = this.index(t);
      if (i < 0) return 0;
      return Math.exp(-(t - this.time(i)) / decay);
    },
  };

  // ------------------------------------------------------------------
  // Camera: punch-ins and shakes applied to one layer
  // ------------------------------------------------------------------

  const cameraHits = [];

  const camera = {
    /**
     * A punch-in: the layer zooms in by `amount` and eases back out. With
     * `rise` (seconds) it builds smoothly instead of jumping in one frame.
     */
    punch(at, amount = 0.035, rise = 0) {
      cameraHits.push({ kind: 'punch', at, amount, rise });
    },
    shake(at, amount = 7) {
      cameraHits.push({ kind: 'shake', at, amount });
    },
    attach(node) {
      onFrame((t) => {
        let scale = 1;
        let x = 0;
        let y = 0;
        for (const hit of cameraHits) {
          const age = t - hit.at;
          if (age < 0 || age > 0.6 + (hit.rise || 0)) continue;
          if (hit.kind === 'punch') {
            const rise = hit.rise || 0;
            const k = rise > 0 ? Math.min(1, age / rise) : 1;
            scale += hit.amount * k * k * (3 - 2 * k) * Math.exp(-Math.max(0, age - rise) / 0.14);
          } else {
            const fade = Math.exp(-age / 0.12);
            x += hit.amount * fade * Math.sin(age * 70);
            y += hit.amount * 0.6 * fade * Math.cos(age * 55);
          }
        }
        node.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      });
    },
  };

  window.Timeline = {
    EASE, tween, onBeforeFrame, onFrame, onDispose, dispose, seek, fx, beats, camera,
    clamp, progress, easeOutCubic, easeInOutCubic, hash01,
  };
})();
