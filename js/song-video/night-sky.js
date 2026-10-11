/*
 * The "night-sky" stage theme: a starry fantasy-tech sky behind the scenes
 * (deep navy gradient, drifting nebulae, three parallax star layers, a
 * guiding star, rare shooting stars, and warm embers). Storyboards select it
 * with `theme: night-sky`; night-sky.css holds its look. Only the backdrop
 * changes: the HUD, type, and boxes stay the studio theme's, so every song
 * video speaks the same visual language.
 *
 * Everything is a pure function of song time, like the rest of the stage.
 * Motion is slow and low-contrast on purpose: the sky must never compete
 * with the diagrams, and nothing large changes brightness quickly (WCAG
 * 2.3.1; render.js screens every frame).
 */
(function () {
  'use strict';

  const { onFrame, beats, hash01, clamp } = window.Timeline;
  const { el } = window.SongKit;

  const WIDTH = 960;
  const HEIGHT = 540;

  /** box-shadow list of `count` stars, tiled twice across 2 × WIDTH for seamless drift. */
  function starShadows(count, seed, { minSize, maxSize, alpha, tint }) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const x = hash01(seed * 7919 + i * 13) * WIDTH;
      const y = hash01(seed * 104729 + i * 31) * HEIGHT;
      const size = minSize + (maxSize - minSize) * hash01(seed * 31 + i * 7);
      const a = alpha * (0.55 + 0.45 * hash01(seed * 53 + i));
      const color = hash01(seed * 17 + i * 3) < tint ? `rgba(170, 215, 255, ${a.toFixed(2)})` : `rgba(255, 255, 255, ${a.toFixed(2)})`;
      for (const dx of [0, WIDTH]) {
        stars.push(`${(x + dx).toFixed(1)}px ${y.toFixed(1)}px 0 ${(size / 2).toFixed(2)}px ${color}`);
      }
    }
    return stars.join(', ');
  }

  function starLayer(parent, kind, count, seed, options, speed) {
    const layer = el('div', `sky-stars sky-stars--${kind}`, parent);
    const dots = el('div', 'sky-stars-dots', layer);
    dots.style.boxShadow = starShadows(count, seed, options);
    onFrame((t) => {
      layer.style.transform = `translate(${(-(t * speed) % WIDTH).toFixed(2)}px, 0)`;
    });
    return layer;
  }

  /** Bright stars with a soft cross flare that twinkle on their own slow cycles. */
  function brightStars(parent, count, seed) {
    const layer = el('div', 'sky-bright', parent);
    const stars = Array.from({ length: count }, (_, i) => {
      const node = el('div', 'sky-bright-star', layer);
      node.style.left = `${(hash01(seed + i * 97) * WIDTH).toFixed(1)}px`;
      node.style.top = `${(hash01(seed * 3 + i * 61) * HEIGHT * 0.86).toFixed(1)}px`;
      const scale = 0.55 + 0.6 * hash01(seed * 5 + i * 11);
      // Periods are mutually non-integer so the twinkles never sync up.
      return { node, scale, period: 2.3 + 4.1 * hash01(seed * 7 + i * 5), phase: hash01(seed * 11 + i) * Math.PI * 2 };
    });
    onFrame((t) => {
      for (const star of stars) {
        const twinkle = 0.62 + 0.38 * Math.sin((t / star.period) * Math.PI * 2 + star.phase);
        star.node.style.opacity = twinkle.toFixed(3);
        star.node.style.transform = `scale(${(star.scale * (0.85 + 0.15 * twinkle)).toFixed(3)})`;
      }
    });
  }

  /** The bright star high in the sky; it breathes gently with the beat. */
  function guidingStar(parent) {
    const node = el('div', 'sky-guide', parent);
    el('div', 'sky-guide-halo', node);
    el('div', 'sky-guide-flare', node);
    el('div', 'sky-guide-flare sky-guide-flare--cross', node);
    el('div', 'sky-guide-core', node);
    onFrame((t) => {
      const pulse = beats.pulse(t, 0.3);
      node.style.transform = `scale(${(1 + 0.05 * pulse + 0.03 * Math.sin(t * 0.7)).toFixed(4)})`;
    });
  }

  function nebulae(parent) {
    const clouds = [
      { kind: 'blue', x: 360, y: 120, rx: 26, ry: 14, w: 0.021, phase: 0 },
      { kind: 'cyan', x: 120, y: 330, rx: 22, ry: 18, w: 0.017, phase: 1.7 },
      { kind: 'violet', x: 760, y: 150, rx: 30, ry: 16, w: 0.019, phase: 3.1 },
      { kind: 'amber', x: 820, y: 470, rx: 18, ry: 10, w: 0.023, phase: 4.4 },
    ].map((cloud) => ({ ...cloud, node: el('div', `sky-nebula sky-nebula--${cloud.kind}`, parent) }));
    onFrame((t) => {
      const pulse = beats.pulse(t, 0.4);
      for (const cloud of clouds) {
        const a = t * cloud.w * Math.PI * 2 + cloud.phase;
        const x = cloud.x + cloud.rx * Math.cos(a);
        const y = cloud.y + cloud.ry * Math.sin(a * 1.3);
        cloud.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + 0.025 * pulse).toFixed(4)})`;
      }
    });
  }

  /** A streak every 9–15 s, each with its own path; at most one at a time. */
  function shootingStars(parent, duration) {
    const node = el('div', 'sky-shooting', parent);
    const streaks = [];
    for (let at = 6.3, i = 0; at < duration - 2; i++) {
      streaks.push({
        at,
        x: 120 + hash01(i * 211 + 5) * 700,
        y: 20 + hash01(i * 157 + 9) * 150,
        angle: 18 + hash01(i * 89 + 2) * 16,
      });
      at += 9 + hash01(i * 37 + 1) * 6;
    }
    const LIFE = 0.9;
    onFrame((t) => {
      const streak = streaks.find((s) => t >= s.at && t < s.at + LIFE);
      if (!streak) {
        node.style.opacity = '0';
        return;
      }
      const p = (t - streak.at) / LIFE;
      const travel = 260 * p;
      const rad = (streak.angle * Math.PI) / 180;
      node.style.opacity = (Math.sin(p * Math.PI) * 0.85).toFixed(3);
      node.style.transform = `translate(${(streak.x + travel * Math.cos(rad)).toFixed(1)}px, ${(streak.y + travel * Math.sin(rad)).toFixed(1)}px) rotate(${streak.angle.toFixed(1)}deg)`;
    });
  }

  /** Warm sparks that drift up from below the frame, like the reference art's embers. */
  function embers(parent, count) {
    const layer = el('div', 'sky-embers', parent);
    const sparks = Array.from({ length: count }, (_, i) => {
      const node = el('div', `sky-ember${hash01(i * 19 + 3) < 0.3 ? ' sky-ember--cool' : ''}`, layer);
      return {
        node,
        x: hash01(i * 71 + 4) * WIDTH,
        speed: 9 + 14 * hash01(i * 13 + 8),
        sway: 6 + 10 * hash01(i * 5 + 1),
        period: 3.1 + 3.7 * hash01(i * 29 + 6),
        offset: hash01(i * 43 + 2),
      };
    });
    const RISE = HEIGHT + 40;
    onFrame((t) => {
      for (const spark of sparks) {
        const life = ((t * spark.speed) / RISE + spark.offset) % 1;
        const y = HEIGHT + 20 - life * RISE;
        const x = spark.x + spark.sway * Math.sin((t / spark.period) * Math.PI * 2);
        spark.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        spark.node.style.opacity = (clamp(Math.sin(life * Math.PI) * 1.3, 0, 1) * 0.75).toFixed(3);
      }
    });
  }

  function nightSky(stage, { duration = 600 } = {}) {
    const layer = el('div', 'layer night-sky', stage);
    el('div', 'sky-gradient', layer);
    nebulae(layer);
    starLayer(layer, 'far', 260, 3, { minSize: 0.7, maxSize: 1.3, alpha: 0.55, tint: 0.4 }, 1.6);
    starLayer(layer, 'mid', 110, 7, { minSize: 1.2, maxSize: 2.0, alpha: 0.8, tint: 0.3 }, 3.4);
    brightStars(layer, 18, 11);
    guidingStar(layer);
    shootingStars(layer, duration);
    embers(layer, 26);
    el('div', 'sky-vignette', layer);
    return layer;
  }

  window.SongKit.themes['night-sky'] = { build: nightSky };
})();
