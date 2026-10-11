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
  const updaters = [];

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

  function seek(t) {
    for (const animation of animations) animation.currentTime = t * 1000;
    for (const update of updaters) update(t);
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

  const beats = {
    period: 60 / 95,
    first: 0,
    configure({ bpm, first }) {
      this.period = 60 / bpm;
      this.first = first;
    },
    /** Index of the last beat at or before t (−1 before the first beat). */
    index(t) {
      return Math.floor((t - this.first) / this.period + 1e-9);
    },
    /** 1 on a beat, decaying exponentially until the next one. */
    pulse(t, decay = 0.11) {
      const i = this.index(t);
      if (i < 0) return 0;
      return Math.exp(-(t - (this.first + i * this.period)) / decay);
    },
  };

  // ------------------------------------------------------------------
  // Camera: punch-ins and shakes applied to one layer
  // ------------------------------------------------------------------

  const cameraHits = [];

  const camera = {
    punch(at, amount = 0.035) {
      cameraHits.push({ kind: 'punch', at, amount });
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
          if (age < 0 || age > 0.6) continue;
          if (hit.kind === 'punch') {
            scale += hit.amount * Math.exp(-age / 0.14);
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
    EASE, tween, onFrame, seek, fx, beats, camera,
    clamp, progress, easeOutCubic, easeInOutCubic, hash01,
  };
})();
