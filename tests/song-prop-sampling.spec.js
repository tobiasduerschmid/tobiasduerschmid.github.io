const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// Component fixture: native SVG geometry is essential to this contract, so
// load the real renderer without the song, audio, server, or a fake getCTM.
async function prepareCast(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.setContent('<main><div class="stage" data-testid="prop-stage" aria-hidden="true"></div></main>');
  for (const file of ['song-video-stage.css', 'song-video-opera-cast.css']) {
    await page.addStyleTag({ path: path.join(root, 'css', file) });
  }
  for (const file of ['timeline.js', 'figure-geometry.js', 'kit.js', 'opera-cast.js']) {
    await page.addScriptTag({ path: path.join(root, 'js/song-video', file) });
  }
  await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="prop-stage"]');
    stage.style.transform = 'scale(0.8)';
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    window.propFixture = {
      stage,
      reducedMotion: motion.matches,
      create(side, action = 'allowed') {
        return window.OperaCast.figure(stage, {
          role: 'backend', stage: [[1, 8, { enter: 'left', exit: 'right' }]],
          places: [[0, 400, 452, 0.95], [3, 600, 452, 0.7, 1]],
          holds: [[1, side, 'mug'], [6, side, null]],
          moves: [[2, 'mood', { lean: 12, crouch: 0.4, hold: 5 }],
            ...(action === 'none' ? [] : [[3, 'arms', {
              [side]: { reach: [136, 60], shape: 'grip', dir: -60 },
              hold: 1, allowHeld: action === 'allowed',
            }]])],
        });
      },
    };
    motion.addEventListener('change', event => { window.propFixture.reducedMotion = event.matches; });
  });
}

function expectMatrix(actual, expected, label) {
  expect(actual, label).toHaveLength(6);
  actual.forEach((value, i) => expect(value, `${label}: ${'abcdef'[i]}`).toBeCloseTo(expected[i], 6));
}

for (const side of ['left', 'right']) {
  test(`${side} rigid cane keeps its grip and planted foot while a scaled figure leans`, async ({ page }) => {
    await prepareCast(page);
    const samples = await page.evaluate(side => {
      const stage = window.propFixture.stage;
      const figures = [0.95, 1.25].map(scale => ({ scale, figure: window.OperaCast.figure(stage, {
        role: 'ui', stage: [[0, 10]], places: [[0, 480, 452, scale]], holds: [[0, side, 'cane']],
        moves: [[2, 'mood', { crouch: 0.6, lean: 3, hold: 4 }]],
      }) }));
      const paintedPoint = (node, coordinates) => {
        const viewport = node.ownerSVGElement, rect = viewport.getBoundingClientRect();
        const bounds = stage.getBoundingClientRect(), scale = bounds.width / 960;
        const box = viewport.viewBox.baseVal;
        const local = new DOMPoint(...coordinates).matrixTransform(
          viewport.getScreenCTM().inverse().multiply(node.getScreenCTM()));
        return [(rect.left - bounds.left + (local.x - box.x) * rect.width / box.width) / scale,
          (rect.top - bounds.top + (local.y - box.y) * rect.height / box.height) / scale];
      };
      return [0, 1.8, 2.2, 5, 7, 2.2].flatMap(time => {
        window.Timeline.seek(time);
        return figures.map(({ scale, figure }) => {
          const prop = figure.node.querySelector('[data-prop="cane"]');
          const hand = figure.node.querySelector(`[data-testid="oc-arm-${side}"] [data-testid="oc-hand"]`);
          const contact = paintedPoint(prop, window.OperaCast.HOLDING.cane.contact);
          const grip = paintedPoint(hand, window.OperaCast.HOLDING.cane.hand);
          const tip = paintedPoint(prop, [3, 128]);
          return { time, scale, tipY: tip[1], contactError: Math.hypot(contact[0] - grip[0], contact[1] - grip[1]),
            length: Math.hypot(tip[0] - contact[0], tip[1] - contact[1]) };
        });
      });
    }, side);
    for (const { time, scale, tipY, contactError, length } of samples) {
      expect(Math.abs(tipY - 452), `planted cane at ${time}, figure scale ${scale}`).toBeLessThan(0.05);
      expect(contactError, `hand retains the handle at ${time}, figure scale ${scale}`).toBeLessThan(0.02);
      expect(length, `rigid cane is not stretched to reach the floor at ${time}`).toBeCloseTo(Math.hypot(3, 131) * scale, 3);
    }
  });

  test(`${side} held arm only leaves its carry pose for an explicitly authored action`, async ({ page }) => {
    await prepareCast(page);
    const result = await page.evaluate(side => {
      const { create } = window.propFixture;
      const baseline = create(side, 'none'), reserved = create(side, 'reserved'), authored = create(side);
      const other = side === 'left' ? 'right' : 'left';
      const distance = (a, b, arm) => Math.hypot(...a.handPoint(arm, [0, 11]).map((v, i) => v - b.handPoint(arm, [0, 11])[i]));
      window.Timeline.seek(3.5);
      const reservedDrift = distance(reserved, baseline, side);
      const authoredTravel = distance(authored, baseline, side);
      const otherArmDrift = distance(authored, baseline, other);
      window.Timeline.seek(5.5);
      return { reservedDrift, authoredTravel, otherArmDrift, returnedDrift: distance(authored, baseline, side) };
    }, side);
    expect(result.reservedDrift, 'ordinary gestures preserve the carrying hand').toBeLessThan(0.000001);
    expect(result.authoredTravel, 'explicit action reaches with the occupied hand').toBeGreaterThan(25);
    expect(result.otherArmDrift, 'explicit action is not redirected to the other hand').toBeLessThan(0.000001);
    expect(result.returnedDrift, 'completed action returns to the carry pose').toBeLessThan(0.000001);
  });

  test(`${side} hand follows its authored throw through prop release`, async ({ page }) => {
    await prepareCast(page);
    const result = await page.evaluate(side => {
      const create = releaseAt => window.OperaCast.figure(window.propFixture.stage, {
        role: 'backend', stage: [[0, 10]], places: [[0, 480, 452, 1]],
        holds: [[0, side, 'mug'], [releaseAt, side, null]],
        moves: [
          [5.15, 'arms', { [side]: { reach: [104, 80], shape: 'grip', dir: -45 }, hold: 1.2, allowHeld: true }],
          [6.1, 'arms', { [side]: { reach: [180, 82], shape: 'grip', dir: -15 }, hold: 0.3, allowHeld: true }],
        ],
      });
      const throwing = create(6), carrying = create(8);
      const samples = [5.999, 6, 6.001, 6.15, 6.299, 6.35].map(time => {
        window.Timeline.seek(time);
        return { time, actual: throwing.handPoint(side, [0, 11]),
          intended: carrying.handPoint(side, [0, 11]), released: throwing.propMatrix(side) === null };
      });
      window.Timeline.seek(9);
      window.Timeline.seek(6.15);
      return { samples, reverse: throwing.handPoint(side, [0, 11]) };
    }, side);
    for (const { time, actual, intended, released } of result.samples) {
      expect(actual, `release must not interrupt the authored hand trajectory at ${time}`).toEqual(intended);
      expect(released, `mug ownership changes exactly at release ${time}`).toBe(time >= 6);
    }
    expect(Math.hypot(...result.samples[1].actual.map((v, i) => v - result.samples[0].actual[i])),
      'the hand remains continuous across release').toBeLessThan(1);
    expect(result.reverse, 'reverse seek reproduces the same follow-through').toEqual(result.samples[3].actual);
  });

  test(`${side} ordinary release still returns the empty arm to rest`, async ({ page }) => {
    await prepareCast(page);
    const result = await page.evaluate(side => {
      const create = (holds, moves = []) => window.OperaCast.figure(window.propFixture.stage, {
        role: 'backend', stage: [[0, 10]], places: [[0, 480, 452, 1]], holds, moves,
      });
      const holds = [[0, side, 'mug'], [6, side, null]];
      const ordinary = create(holds);
      const finishedAction = create(holds, [[3, 'arms', {
        [side]: { reach: [136, 60], shape: 'grip', dir: -60 }, hold: 0.5, allowHeld: true,
      }]]);
      const empty = create([]);
      window.Timeline.seek(5.5);
      const carried = ordinary.propMatrix(side);
      window.Timeline.seek(6.5);
      return { carried, empty: empty.handPoint(side, [0, 11]),
        ordinary: ordinary.handPoint(side, [0, 11]), finishedAction: finishedAction.handPoint(side, [0, 11]),
        released: ordinary.propMatrix(side) };
    }, side);
    expect(result.carried, 'mug is held before release').toHaveLength(6);
    expect(result.released).toBeNull();
    expect(result.ordinary, 'ordinary clear restores the empty rest pose').toEqual(result.empty);
    expect(result.finishedAction, 'an already completed action does not suppress a later clear').toEqual(result.empty);
  });

  test(`${side} prop matrix matches painted geometry and preserves upright handle contact`, async ({ page }) => {
    await prepareCast(page);
    const samples = await page.evaluate(side => {
      const figure = window.propFixture.create(side);
      return [1.1, 3.5, 5.999].map(time => {
        window.Timeline.seek(time);
        const matrix = figure.propMatrix(side);
        const prop = figure.node.querySelector('[data-testid="oc-held-prop"]');
        const bounds = window.propFixture.stage.getBoundingClientRect();
        const scale = bounds.width / 960;
        const viewport = prop.ownerSVGElement;
        const viewportBounds = viewport.getBoundingClientRect(), viewBox = viewport.viewBox.baseVal;
        // WebKit excludes CSS ancestor scaling from screen CTMs. Resolve the
        // native SVG transform inside its viewport, then use its painted rect.
        const local = viewport.getScreenCTM().inverse().multiply(prop.getScreenCTM());
        const sx = viewportBounds.width / viewBox.width / scale, sy = viewportBounds.height / viewBox.height / scale;
        const ox = (viewportBounds.left - bounds.left) / scale - viewBox.x * sx;
        const oy = (viewportBounds.top - bounds.top) / scale - viewBox.y * sy;
        const painted = [local.a * sx, local.b * sy, local.c * sx, local.d * sy,
          ox + local.e * sx, oy + local.f * sy];
        const [cx, cy] = window.OperaCast.HOLDING.mug.contact;
        const hand = figure.node.querySelector(`[data-testid="oc-arm-${side}"] [data-testid="oc-hand"]`);
        const contact = new DOMPoint(...window.OperaCast.HOLDING.mug.hand).matrixTransform(
          viewport.getScreenCTM().inverse().multiply(hand.getScreenCTM()));
        const [hx, hy] = [ox + contact.x * sx, oy + contact.y * sy];
        return { time, matrix, painted, contactError: Math.hypot(
          matrix[0] * cx + matrix[2] * cy + matrix[4] - hx,
          matrix[1] * cx + matrix[3] * cy + matrix[5] - hy) };
      });
    }, side);
    for (const { time, matrix, painted, contactError } of samples) {
      // CSS layout rounds the wrapper's left/top to 1/64 px; its drawn
      // translation may differ from the authored stage position by that much.
      matrix.forEach((value, i) => expect(Math.abs(value - painted[i]), `painted ${'abcdef'[i]} at ${time}`)
        .toBeLessThan(i < 4 ? 0.000001 : 0.02));
      expect(contactError, `handle stays in the painted hand at ${time}`).toBeLessThan(0.02);
      expect(Math.abs(matrix[2]), `cup up-vector stays vertical at ${time}`).toBeLessThan(0.001);
      expect(matrix[3], `cup opening stays above its base at ${time}`).toBeGreaterThan(0);
      expect(matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0, `complete mirrored prop at ${time}`).toBe(side === 'left');
    }
  });

  test(`${side} canonical release samples ignore motion preferences without changing the visible pose`, async ({ page }) => {
    await prepareCast(page);
    const expected = await page.evaluate(side => {
      const figure = window.OperaCast.figure(window.propFixture.stage, {
        role: 'backend', stage: [[1, 8, { enter: 'left', exit: 'right' }]],
        places: (time, reduced) => ({ x: reduced ? 650 : 400 + 20 * time, y: 452, scale: 0.8, walking: reduced ? 0 : 0.5 }),
        holds: [[1, side, 'mug'], [6, side, null]],
        moves: [[3, 'arms', { [side]: { reach: [136, 60], shape: 'grip', dir: -60 }, hold: 1.2, allowHeld: true }]],
      });
      window.propFixture.subject = figure;
      return [3.1, 5.995, 5.999].map(time => {
        window.Timeline.seek(time);
        return { time, matrix: figure.propMatrix(side) };
      });
    }, side);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => page.evaluate(() => window.propFixture.reducedMotion)).toBe(true);
    const reduced = await page.evaluate(({ side, times }) => {
      const figure = window.propFixture.subject;
      window.Timeline.seek(7);
      const before = figure.handPoint(side, [0, 11]);
      const samples = times.map(time => figure.samplePropAt(side, time, { reducedMotion: false }));
      const after = figure.handPoint(side, [0, 11]), released = figure.propMatrix(side);
      window.Timeline.seek(3.1);
      const heldBefore = figure.propMatrix(side);
      const defaultSample = figure.samplePropAt(side, 3.1);
      figure.samplePropAt(side, 5.999, { reducedMotion: false });
      return { samples, before, after, released, heldBefore, defaultSample, heldAfter: figure.propMatrix(side),
        preference: matchMedia('(prefers-reduced-motion: reduce)').matches };
    }, { side, times: expected.map(sample => sample.time) });
    reduced.samples.forEach((matrix, i) => expectMatrix(matrix, expected[i].matrix, `canonical sample at ${expected[i].time}`));
    expect(reduced.after, 'canonical sampling preserves the visible reduced-motion hand').toEqual(reduced.before);
    expect(reduced.released, 'canonical sampling preserves released ownership').toBeNull();
    expectMatrix(reduced.heldAfter, reduced.heldBefore, 'canonical sampling preserves the currently held mug');
    expectMatrix(reduced.defaultSample, reduced.heldBefore, 'sampling without an override still uses the current preference');
    expect(reduced.preference, 'sampling never changes the motion preference').toBe(true);
    expect(Math.hypot(reduced.heldBefore[4] - expected[0].matrix[4], reduced.heldBefore[5] - expected[0].matrix[5]),
      'fixture exercises distinct full and reduced placement/pose').toBeGreaterThan(50);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => page.evaluate(() => window.propFixture.reducedMotion)).toBe(false);
    const forcedReduced = await page.evaluate(side => {
      const figure = window.propFixture.subject;
      window.Timeline.seek(3.1);
      const sampled = figure.samplePropAt(side, 3.1, { reducedMotion: true });
      return { sampled, current: figure.propMatrix(side) };
    }, side);
    expectMatrix(forcedReduced.sampled, reduced.heldBefore, 'an explicit reduced sample also honors its override');
    expectMatrix(forcedReduced.current, expected[0].matrix, 'sampling restores the visible full-motion pose');
  });

  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`${side} release sampling preserves the current pose through direct and reverse seeks (${reducedMotion})`, async ({ page }) => {
      await prepareCast(page, reducedMotion);
      const result = await page.evaluate(side => {
        const figure = window.propFixture.create(side), timeline = window.Timeline;
        const contact = () => figure.handPoint(side, [0, 11]);
        const initial = contact();
        const firstSample = figure.samplePropAt(side, 3.5);
        const afterInitialSample = { contact: contact(), prop: figure.propMatrix(side) };
        const times = [1.1, 3.1, 3.5, 4.7, 5.999];
        const expected = times.map(time => { timeline.seek(time); return figure.propMatrix(side); });
        timeline.seek(7);
        const releasedContact = contact();
        let sceneUpdates = 0;
        timeline.onFrame(() => sceneUpdates++);
        const samples = [4, 0, 2, 1, 3, 2].map(index => ({
          time: times[index], expected: expected[index], sampled: figure.samplePropAt(side, times[index]),
          current: figure.propMatrix(side), contact: contact(),
        }));
        const atRelease = figure.samplePropAt(side, 6);
        timeline.seek(9); // Offstage callbacks normally leave the last pose in place.
        const offstageContact = contact();
        figure.node.remove(); // Match the scene's culling of inactive figures.
        const detachedSample = figure.samplePropAt(side, 3.5);
        const afterDetachedSample = { prop: figure.propMatrix(side), detached: !figure.node.parentNode };
        window.propFixture.stage.appendChild(figure.node);
        afterDetachedSample.contact = contact();
        timeline.seek(3.5);
        const heldBefore = figure.propMatrix(side);
        const emptySample = figure.samplePropAt(side, 6);
        return { initial, firstSample, afterInitialSample, expected, samples, releasedContact,
          atRelease, sceneUpdates, offstageContact, detachedSample, afterDetachedSample,
          heldBefore, emptySample, heldAfter: figure.propMatrix(side),
          heldCount: figure.node.querySelectorAll('[data-testid="oc-held-prop"]').length };
      }, side);
      expect(result.afterInitialSample.prop, 'sampling before the first entrance leaves no mug behind').toBeNull();
      expect(result.afterInitialSample.contact).toEqual(result.initial);
      expectMatrix(result.firstSample, result.expected[2], 'direct first sample');
      for (const sample of result.samples) {
        expectMatrix(sample.sampled, sample.expected, `sample at ${sample.time}`);
        expect(sample.current, 'sampling the past does not restore a released mug').toBeNull();
        expect(sample.contact, 'sampling restores the currently rendered hand').toEqual(result.releasedContact);
      }
      expect(result.atRelease, 'the exact release boundary has an empty hand').toBeNull();
      expect(result.sceneUpdates, 'sampling never seeks the scene; only the two explicit seeks run').toBe(2);
      expectMatrix(result.detachedSample, result.expected[2], 'sample of a culled figure');
      expect(result.afterDetachedSample.detached, 'sampling preserves scene culling').toBe(true);
      expect(result.afterDetachedSample.prop).toBeNull();
      expect(result.afterDetachedSample.contact).toEqual(result.offstageContact);
      expect(result.emptySample).toBeNull();
      expectMatrix(result.heldAfter, result.heldBefore, 'sampling after release preserves the current held mug');
      expect(result.heldCount, 'one mug remains in the carrying hand').toBe(1);
    });
  }
}
