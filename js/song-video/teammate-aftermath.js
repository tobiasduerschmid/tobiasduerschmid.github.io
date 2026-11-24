/* The office remembers all six incidents. State is reconstructed from song time,
 * including direct/backward seeks; playback never appends debris. */
(function (root) {
  'use strict';
  const progress = (time, at, duration) => Math.max(0, Math.min(1, (time - at) / duration));
  const smooth = (u) => u * u * (3 - 2 * u);
  const mix = (a, b, u) => a + (b - a) * u;
  const GRAVITY = 460; // Stage pixels / second²; shared by free and rebounding props.

  /** A ballistic toss between known contacts, clamped only at those contacts. */
  function arcFlight({ from, to, duration, arc }, elapsed) {
    const u = progress(elapsed, 0, duration);
    return [mix(from[0], to[0], u), mix(from[1], to[1], u) - 4 * arc * u * (1 - u)];
  }
  function projectile({ position, velocity, gravity }, elapsed) {
    return [position[0] + velocity[0] * elapsed, position[1] + velocity[1] * elapsed + gravity * elapsed * elapsed / 2];
  }
  function floorContactTime({ position, velocity, gravity }, floor) {
    return (-velocity[1] + Math.sqrt(velocity[1] ** 2 + 2 * gravity * (floor - position[1]))) / gravity;
  }
  // A collision may change velocity; gravity remains constant during the hop.
  function bounceHeight(elapsed, duration, gravity = GRAVITY) {
    const t = Math.max(0, Math.min(duration, elapsed));
    return gravity * t * (duration - t) / 2;
  }
  const visible = (node, show) => node.classList.toggle('tm-aftermath-hidden', !show);
  const pose = (node, [x, y], angle = 0, scale = 1) => node.setAttribute('transform', `translate(${x} ${y}) rotate(${angle}) scale(${scale})`);
  const quiet = (node, amount) => {
    node.classList.add('tm-aftermath-residue');
    node.style.setProperty('--aftermath-rest', amount.toFixed(3));
  };
  // Residue settles into the lighting gradually, with zero velocity at each end.
  const REST_DURATION = 3.2;
  let instanceCount = 0;

  /** Cues are semantic word times. Call update after the figures have been posed. */
  function create({ content, cues }) {
    const { svg } = root.SongKit;
    const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    const layer = (name) => svg('svg', {
      class: 'tm-aftermath-layer', viewBox: '0 0 960 540', 'aria-hidden': 'true', 'data-testid': name,
    }, content);
    const back = layer('aftermath-back');
    const art = root.TeammateAftermathArt.create(back);
    const ground = layer('aftermath-ground');
    for (const key of ['binBack', 'report', 'fragments']) ground.appendChild(art[key]);
    const coffeeFloor = svg('g', {}, ground);
    ground.insertBefore(coffeeFloor, art.fragments);
    art.fragments.querySelectorAll('.ta-coffee-floor, .ta-fragment-shadow').forEach(node => coffeeFloor.appendChild(node));
    const desk = layer('aftermath-desk');
    desk.appendChild(art.report);
    const front = layer('aftermath-front');
    ground.appendChild(art.binFront);
    const bin = [330, 380];
    pose(art.binBack, bin); pose(art.binFront, bin);
    art.binBack.setAttribute('data-testid', 'aftermath-bin');
    const names = { report: 'tests', paint: 'coupling', coffee: 'coffee', scorch: 'secrets' };
    for (const [key, name] of Object.entries(names)) art[key].setAttribute('data-testid', `aftermath-${name}`);
    const cartonShadow = svg('ellipse', { class: 'tm-aftermath-contact-shadow', cx: 520, cy: 414, rx: 37, ry: 4 }, ground);

    const reportShadow = svg('ellipse', { class: 'tm-aftermath-contact-shadow', cx: 273, cy: 337, rx: 25, ry: 3 }, desk);
    desk.insertBefore(reportShadow, art.report);
    const slot = svg('path', { class: 'tm-aftermath-slot', d: 'M588 318 H632', 'data-testid': 'aftermath-report-slot' }, front);
    // The upper wall receives exhaust; the clock/window/build board retain their clear surfaces.
    const prefix = `teammate-aftermath-motion-${++instanceCount}`;
    const wallClip = svg('clipPath', { id: `${prefix}-wall` }, back);
    // Match the painted silhouettes: bounding-box cutouts leave rectangular
    // patches of clean wall visible through the feathered smoke.
    svg('path', { d: 'M48 50H914V404H48Z M58 70H246Q252 70 252 76V150Q252 156 246 156H58Q52 156 52 150V76Q52 70 58 70Z M754 226V134A72 60 0 0 1 898 134V226H904V234H748V226Z M742 112A34 34 0 1 1 674 112A34 34 0 1 1 742 112Z', 'clip-rule': 'evenodd' }, wallClip);
    const depositClip = svg('clipPath', { id: `${prefix}-deposit` }, back);
    const depositArea = svg('rect', { x: 535, y: 345, width: 215, height: 0 }, depositClip);
    const wallScorch = svg('g', { 'clip-path': `url(#${prefix}-wall)` }, back);
    svg('g', { 'clip-path': `url(#${prefix}-deposit)` }, wallScorch).appendChild(art.scorch);
    wallScorch.appendChild(art.flames);
    art.flames.setAttribute('data-testid', 'aftermath-flames');
    back.appendChild(art.exhaust);
    const mug = root.OperaCast.PROPS.mug(svg('g', { 'data-testid': 'aftermath-flying-mug' }, front));
    // Steam belongs to a resting hot drink, not a tumbling cup.
    mug.querySelectorAll('.oc-steam').forEach((node) => node.remove());
    const palette = root.OperaCast.PROPS.palette(svg('g', { 'data-testid': 'aftermath-flying-palette' }, front));
    const story = root.OperaCast.PROPS.clipboard(svg('g', { 'data-testid': 'aftermath-requirements' }, front));
    const releases = new Map();
    function sampleRelease(figure, at, key, side = 'left') {
      if (!releases.has(key)) {
        const matrix = figure.samplePropAt(side, at - .00001, { reducedMotion: false });
        const before = figure.samplePropAt(side, at - .00401, { reducedMotion: false });
        releases.set(key, { matrix, position: matrix.slice(4),
          velocity: [(matrix[4]-before[4])/.004, (matrix[5]-before[5])/.004] });
      }
      return releases.get(key);
    }
    let oldPackage = null, sourcePackage = null, packageRelease = null;

    function updateStory(t, pm) {
      const elapsed = t - cues.story;
      visible(story, elapsed >= 0);
      if (elapsed < 0) return;
      const source = { ...sampleRelease(pm, cues.story, 'story'), gravity: GRAVITY };
      const duration = floorContactTime(source, 386);
      const down = reduced.matches ? duration : Math.min(duration, elapsed);
      // Sink the bottom of the board into the mouth, behind its front rim.
      // Stopping at the opening's centre left it balanced on top of the lip.
      // Continue the actual hand velocity. Never bend the path to steer into
      // the bin: the release choreography aims it, and gravity does the rest.
      const position = projectile(source, down);
      // The carrying grip holds this board upright, with no release spin.
      const angle = 0;
      const [a,b,c,d] = source.matrix;
      story.setAttribute('transform', `translate(${position[0]} ${position[1]}) rotate(${angle}) matrix(${a} ${b} ${c} ${d} 0 0)`);
      story.dataset.settled = String(down === duration);
      quiet(story, reduced.matches ? 1 : smooth(progress(elapsed, duration + .1, REST_DURATION)));
      // Only the final entry passes behind the lip; free flight stays above scene panels.
      const inside = position[1] > 364 && Math.abs(position[0] - bin[0]) < 25;
      if (inside && story.parentNode !== ground) ground.insertBefore(story, art.binFront);
      else if (!inside && story.parentNode !== front) front.appendChild(story);
    }

    function updateDependency(t) {
      const elapsed = t - cues.dependency;
      if (!oldPackage) return;
      visible(sourcePackage, elapsed < 0);
      visible(oldPackage, elapsed >= 0);
      // The pictured cached package slips out on “new”, keeping its exact
      // silhouette and scale at release before falling toward the rear floor.
      const floor = 414, restScale = .84;
      const fall = { position: packageRelease.position, velocity: [160, 0], gravity: GRAVITY };
      // Support is the lowest painted box corner, not its centre. It first
      // contacts one corner, then rocks flat without hovering or sinking.
      const foot = angle => {
        const r = angle * Math.PI / 180;
        return Math.max(...[[2,10],[12,2],[82,2],[82,48],[72,56],[2,56]]
          .map(([x,y]) => (x-41)*Math.sin(r) + (y-29)*Math.cos(r)));
      };
      const lands = floorContactTime(fall, floor - restScale * foot(-18));
      fall.velocity[0] = (520 - fall.position[0]) / lands;
      const down = reduced.matches && elapsed >= 0 ? lands + .25 : Math.max(0, elapsed);
      const position = projectile(fall, Math.min(down, lands));
      const u = progress(down, 0, lands);
      const settling = smooth(progress(down, lands, .24));
      const angle = -18 * u * (1 - settling);
      const bounce = bounceHeight(down - lands, .24);
      const scale = mix(packageRelease.scale, restScale, smooth(u));
      if (down >= lands) position[1] = floor - scale * foot(angle);
      oldPackage.setAttribute('transform', `translate(${position[0]} ${position[1] - bounce}) rotate(${angle}) scale(${scale}) translate(-41 -29)`);
      const targetLayer = down < lands ? front : ground;
      if (oldPackage.parentNode !== targetLayer) targetLayer.appendChild(oldPackage);
      visible(cartonShadow, down >= lands && elapsed >= 0);
      cartonShadow.setAttribute('cx', position[0]);
      oldPackage.dataset.settled = String(down >= lands + .24);
      quiet(oldPackage, reduced.matches ? 1 : smooth(progress(down, lands + .24, REST_DURATION)));
      const damaged = down >= lands;
      oldPackage.querySelector('.mk-box').setAttribute('d', damaged
        ? 'M2 10 L13 13 L22 10 H72 V56 H2 Z' : 'M2 10 H72 V56 H2 Z');
      oldPackage.querySelector('.mk-box-top').setAttribute('d', damaged
        ? 'M2 10 L12 2 H82 L72 10 H22 L13 13 Z' : 'M2 10 L12 2 H82 L72 10 Z');
      for (const selector of ['.mk-box', '.mk-box-top']) {
        const face = oldPackage.querySelector(selector);
        face.previousElementSibling.setAttribute('d', face.getAttribute('d'));
      }
      oldPackage.querySelectorAll('.tm-aftermath-box-crease').forEach(node => visible(node, damaged));
    }

    function updateReport(t) {
      const elapsed = t - cues.tests;
      const duration = 1.2;
      const u = reduced.matches && elapsed >= 0 ? 1 : progress(elapsed, 0, duration);
      visible(slot, elapsed >= -.12 && elapsed < .55);
      visible(art.report, elapsed >= 0);
      // The failing visual ejects the sheet; no independent hand is presented as a grip.
      pose(art.report, arcFlight({ from: [610, 330], to: [274, 357], duration, arc: GRAVITY * duration**2 / 8 }, u * duration), mix(-75, 6, u), mix(.85, .64, smooth(u)));
      const reportLayer = u < 1 ? front : desk;
      if (art.report.parentNode !== reportLayer) reportLayer.appendChild(art.report);
      visible(reportShadow, elapsed >= duration || (reduced.matches && elapsed >= 0));
      quiet(art.report, reduced.matches ? 1 : smooth(progress(elapsed, duration + .1, REST_DURATION)));
    }

    function updatePalette(t, ui) {
      const elapsed = t - cues.palette;
      visible(palette, elapsed >= 0);
      visible(art.paint, false);
      if (elapsed < 0) return;
      const source = { ...sampleRelease(ui, cues.palette, 'palette', 'right'), gravity: GRAVITY };
      const duration = (874 - source.position[0]) / source.velocity[0];
      const hit = projectile(source, duration);
      art.updatePaintDrips(elapsed - duration, { growthDuration: cues.end - cues.palette - duration });
      const impact = reduced.matches || elapsed >= duration;
      visible(art.paint, impact);
      // A compact splash fits below the sill; its growing trails stay on the wall.
      pose(art.paint, hit, 0, .9 * (reduced.matches ? 1 : smooth(progress(elapsed, duration, .12))));
      quiet(art.paint, reduced.matches ? 1 : smooth(progress(elapsed, duration + .2, REST_DURATION)));
      quiet(palette, 0);
      let pos = projectile(source, Math.min(duration, elapsed));
      let angle = 0;
      if (impact) {
        const fall = { position: hit, velocity: [-24, -20], gravity: GRAVITY };
        const lands = floorContactTime(fall, 406);
        const down = reduced.matches ? lands + .25 : elapsed - duration;
        pos = projectile(fall, Math.min(down, lands));
        // Wall contact supplies the torque. Free-flight angular speed is constant.
        angle = 180 * progress(down, 0, lands);
        pos[1] -= bounceHeight(down - lands, .2);
        quiet(palette, reduced.matches ? 1 : smooth(progress(down, lands + .2, REST_DURATION)));
        const destination = down >= lands ? ground : front;
        if (palette.parentNode !== destination) destination.appendChild(palette);
      } else if (palette.parentNode !== front) front.appendChild(palette);
      const [a,b,c,d] = source.matrix;
      palette.setAttribute('transform', `translate(${pos[0]} ${pos[1]}) rotate(${angle}) matrix(${a} ${b} ${c} ${d} 0 0)`);
    }

    function updateCoffee(t, backend) {
      const elapsed = t - cues.coffee;
      if (elapsed < 0) {
        [mug, art.coffee, art.drips, art.fragments, coffeeFloor].forEach(node => visible(node, false));
        return;
      }
      const source = { ...sampleRelease(backend, cues.coffee, 'coffee'), gravity: GRAVITY };
      // Measured arm velocity carries the mug across the stage to the clear
      // wall immediately right of the build board, left of the floating panels.
      const duration = (295 - source.position[0]) / source.velocity[0];
      art.updateCoffeeDrips(elapsed - duration, { growthDuration: cues.end - cues.coffee - duration });
      visible(mug, elapsed >= 0 && elapsed < duration && !reduced.matches);
      visible(art.coffee, elapsed >= duration || (reduced.matches && elapsed >= 0));
      visible(art.drips, elapsed >= duration || (reduced.matches && elapsed >= 0));
      visible(art.fragments, elapsed >= duration || (reduced.matches && elapsed >= 0));
      visible(coffeeFloor, false);
      const hit = projectile(source, duration);
      const pos = projectile(source, Math.min(duration, elapsed));
      const [a, b, c, d] = source.matrix;
      // An upright release has no spin; gravity cannot supply a midair torque.
      const turn = 0;
      mug.setAttribute('transform', `translate(${pos[0]} ${pos[1]}) rotate(${turn}) matrix(${a} ${b} ${c} ${d} 0 0)`);
      const impact = reduced.matches ? 1 : smooth(progress(elapsed, duration, .12));
      pose(art.coffee, hit, 0, impact);
      pose(art.drips, hit);
      const stainRest = reduced.matches ? 1 : smooth(progress(elapsed, duration + .2, REST_DURATION));
      quiet(art.coffee, stainRest * .6); quiet(art.drips, stainRest * .6);
      art.drips.setAttribute('opacity', String(reduced.matches ? 1 : progress(elapsed, duration + .1, 1.2)));
      // The wall impact dissipates the throw. A small rebound puts the pieces
      // to the right of the bin, while gravity carries them to the upstage floor.
      const fall = { position: hit, velocity: [0, -22], gravity: GRAVITY };
      // Centre the debris in the free floor space between bin and package.
      // Derive the rebound speed from that contact, rather than teleporting it.
      const slide = .28 * 14;
      fall.velocity[0] = (420 - slide - hit[0]) / floorContactTime(fall, 414);
      // The chorus stands at y430: debris rests farther upstage, behind its shoes.
      const lands = floorContactTime(fall, 414);
      const down = reduced.matches ? lands + .28 : Math.max(0, elapsed - duration);
      const fragmentPosition = projectile(fall, Math.min(down, lands));
      const bounce = bounceHeight(down - lands, .28);
      const skid = progress(down, lands, .28);
      pose(art.fragments, [fragmentPosition[0] + slide * (2 * skid - skid * skid), fragmentPosition[1] - bounce]);
      visible(coffeeFloor, down >= lands);
      pose(coffeeFloor, projectile(fall, lands));
      quiet(art.fragments, reduced.matches ? 1 : smooth(progress(down, lands + .28, REST_DURATION)));
    }

    function updateSecrets(t) {
      const elapsed = t - cues.secrets;
      visible(wallScorch, elapsed >= 0);
      art.updateFlames(elapsed, { reducedMotion: reduced.matches, growthDuration: cues.end - cues.secrets });
      visible(art.exhaust, elapsed >= 0 && elapsed < 1.65 && !reduced.matches);
      pose(art.scorch, [642, 205]);
      art.scorch.setAttribute('opacity', String(reduced.matches ? 1 : smooth(progress(elapsed, .12, 1.15))));
      quiet(art.scorch, reduced.matches ? .7 : smooth(progress(elapsed, 1.3, REST_DURATION)) * .7);
      const lift = Math.max(0, elapsed);
      const nozzleY = 324 - 170 * lift * lift;
      const depositTop = reduced.matches ? 50 : Math.max(50, Math.min(345, nozzleY + 10));
      depositArea.setAttribute('y', depositTop);
      depositArea.setAttribute('height', 345 - depositTop);
      pose(art.exhaust, [642, nozzleY], 0, mix(.5, 1.4, progress(elapsed, 0, .6)));
      art.exhaust.setAttribute('opacity', String((1 - progress(elapsed, .9, .75)) * .65));
    }

    return {
      roots: [back, ground, desk, front],
      mountDesk() { content.appendChild(desk); },
      mountFront() { content.appendChild(front); },
      dependency(node, stagePosition) {
        sourcePackage = node;
        // The laptop is stationary at this cue. Derive the cached picture's
        // local pose from its SVG, so the release cannot introduce a size jump.
        const local = node.transform.baseVal.consolidate().matrix;
        const center = new DOMPoint(41, 29).matrixTransform(local);
        packageRelease = { position: [stagePosition.x + center.x, stagePosition.y + center.y],
          scale: Math.hypot(local.a, local.b) };
        oldPackage = node.cloneNode(true);
        oldPackage.setAttribute('data-testid', 'aftermath-dependencies');
        svg('path', { class: 'tm-aftermath-box-crease', d: 'M4 15 L13 20 L17 15 M3 45 L11 49 L8 55' }, oldPackage);
        front.appendChild(oldPackage);

      },
      update(t, { backend, pm, ui }) {
        updateStory(t, pm); updateDependency(t); updateReport(t); updatePalette(t, ui); updateCoffee(t, backend); updateSecrets(t);
      },
    };
  }

  const api = { progress, arcFlight, projectile, floorContactTime, bounceHeight, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TeammateAftermath = api;
})(typeof window === 'undefined' ? globalThis : window);
