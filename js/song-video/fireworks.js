/* Deterministic celebratory fireworks on the song's 960×540 stage.
 * Comets launch at `at`; every spark pose comes from absolute song time.
 * No timers, flashing core, sound effects, or particles created during playback.
 */
(function () {
  'use strict';
  const { svg } = window.SongKit;
  const { onFrame, hash01, clamp } = window.Timeline;
  const FLIGHT = 0.65;
  const LIFETIME = 2.7;
  const TRAIL_SAMPLES = 6;

  function sparkPosition(spark, age) {
    const travel = (1 - Math.exp(-1.05 * age)) / 1.05;
    return {
      x: spark.vx * travel + 6 * age,
      y: spark.vy * travel + 24 * age * age,
    };
  }

  function makeBurst(layer, { x, y, delay, tone, scale }, seed) {
    const node = svg('g', { class: `song-firework song-firework--${tone}`, transform: `translate(${x} ${y})` }, layer);
    const glow = svg('path', { class: 'song-firework-glow' }, node);
    const trails = svg('path', { class: 'song-firework-trails' }, node);
    const tips = svg('path', { class: 'song-firework-tips' }, node);
    const embers = svg('path', { class: 'song-firework-embers' }, node);
    const comet = svg('path', { class: 'song-firework-comet' }, node);
    const random = (i, channel) => hash01(seed * 4099 + i * 131 + channel * 17);
    const sparks = Array.from({ length: 72 }, (_, i) => {
      // Three rings at different speeds add volume to the chrysanthemum.
      const angle = (i / 72) * Math.PI * 2 + random(i, 1) * 0.09;
      const speed = (110 + (i % 3) * 40 + random(i, 2) * 28) * scale;
      return {
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.86,
        life: 1.65 + random(i, 3) * 1.05,
        tail: 0.15 + random(i, 4) * 0.25,
        size: 0.65 + random(i, 5) * 0.55,
      };
    });
    return { node, glow, trails, tips, embers, comet, sparks, x, y, delay };
  }

  function dot(x, y, radius) {
    const r = radius.toFixed(2);
    return `M${(x - radius).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${(radius * 2).toFixed(2)} 0a${r} ${r} 0 1 0 ${(-radius * 2).toFixed(2)} 0`;
  }

  function poseComet(burst, age) {
    const p = clamp((age + FLIGHT) / FLIGHT, 0, 1);
    const fromY = 446 - burst.y;
    const endY = fromY * (1 - p) ** 1.4;
    const startY = fromY * (1 - Math.max(0, p - 0.17)) ** 1.4;
    const endX = -24 * (1 - p);
    // A tapered, warm rocket trail with a small hot tip, not a solid line.
    burst.comet.setAttribute('d', `M${endX - 1.5} ${endY}Q${endX - 8} ${(endY + startY) / 2} ${endX - 10} ${startY}Q${endX - 4} ${(endY + startY) / 2} ${endX + 1.5} ${endY}Z${dot(endX, endY, 2.1)}`);
    burst.comet.setAttribute('opacity', age < 0 ? String(clamp(p * 6, 0, 1)) : '0');
  }

  function poseBurst(burst, age) {
    const visible = age >= -FLIGHT && age < LIFETIME;
    burst.node.setAttribute('visibility', visible ? 'visible' : 'hidden');
    if (!visible) return;
    poseComet(burst, age);
    burst.trails.setAttribute('opacity', age >= 0 ? '1' : '0');
    burst.glow.setAttribute('opacity', age >= 0 ? '0.14' : '0');
    burst.tips.setAttribute('opacity', age >= 0 ? '1' : '0');
    burst.embers.setAttribute('opacity', age >= 0 ? '0.55' : '0');
    if (age < 0) return;
    const tails = [], heads = [], dust = [];
    for (const spark of burst.sparks) {
      const fade = clamp((spark.life - age) / 0.8, 0, 1);
      if (fade <= 0) continue;
      const tip = sparkPosition(spark, age);
      // A closed tapered ribbon follows prior positions, so its curve bends
      // down under gravity. The narrowing width makes the ember burn out.
      const left = [], right = [];
      for (let i = 0; i <= TRAIL_SAMPLES; i++) {
        const along = i / TRAIL_SAMPLES;
        const sample = sparkPosition(spark, Math.max(0, age - spark.tail * (1 - along)));
        const width = spark.size * along * fade;
        left.push(`${(sample.x - width).toFixed(1)} ${sample.y.toFixed(1)}`);
        right.unshift(`${(sample.x + width).toFixed(1)} ${sample.y.toFixed(1)}`);
      }
      tails.push(`M${left.join('L')}L${right.join('L')}Z`);
      heads.push(dot(tip.x, tip.y, spark.size * fade));
      // Slower glowing fragments separate along the fading tail, without
      // on/off twinkle cycles that would make the celebration flash.
      for (let i = 1; i <= 3; i++) {
        const fragment = sparkPosition(spark, Math.max(0, age - i * 0.105));
        dust.push(dot(fragment.x, fragment.y + i * age * 2, spark.size * fade * (0.7 - i * 0.12)));
      }
    }
    const path = tails.join('');
    burst.trails.setAttribute('d', path);
    burst.glow.setAttribute('d', path);
    burst.tips.setAttribute('d', heads.join(''));
    burst.embers.setAttribute('d', dust.join(''));
  }

  function celebrate(parent, { at, seed = 7 }) {
    const layer = svg('svg', { class: 'song-fireworks', 'data-testid': 'song-fireworks', viewBox: '0 0 960 450', 'aria-hidden': 'true', focusable: 'false' });
    parent.prepend(layer);
    const bursts = [
      { x: 155, y: 164, delay: 0, tone: 'gold', scale: 0.85 },
      { x: 795, y: 154, delay: 0.52, tone: 'rose', scale: 0.95 },
      { x: 485, y: 125, delay: 1.12, tone: 'teal', scale: 0.9 },
      { x: 190, y: 295, delay: 1.85, tone: 'rose', scale: 0.7 },
      { x: 768, y: 290, delay: 2.3, tone: 'gold', scale: 0.85 },
    ].map((spec, i) => makeBurst(layer, spec, seed + i));
    let active = false;
    onFrame((time) => {
      const age = time - at - FLIGHT;
      const visible = age >= -FLIGHT && age < 2.3 + LIFETIME;
      if (visible !== active) {
        layer.classList.toggle('is-active', visible);
        active = visible;
      }
      if (visible) for (const burst of bursts) poseBurst(burst, age - burst.delay);
    });
    return layer;
  }

  window.SongFireworks = { celebrate };
})();
