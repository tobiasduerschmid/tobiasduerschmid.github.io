// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ reducedMotion: 'no-preference' });

async function openHero(page) {
  await page.goto('/se-gym/');
  await page.waitForFunction(() => window.HeroAvatar);
  await page.evaluate(async () => {
    const svg = await window.HeroAvatar.createSvg('turn-review');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'turn-hero');
    svg.style.cssText = 'display:block;width:640px;height:665px;opacity:1;visibility:visible';
    document.body.replaceChildren(svg);
  });
}

test('turns keep fitted head parts attached, leave necklaces fixed, and reverse without drift', async ({ page }) => {
  await openHero(page);
  const cases = await page.evaluate(() => {
    const api = window.HeroAvatar, svg = document.querySelector('[data-testid="turn-hero"]');
    const centre = selector => {
      const node = svg.querySelector(selector), box = node.getBBox();
      return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
        .matrixTransform(svg.getCTM().inverse().multiply(node.getCTM())).x;
    };
    const sample = () => ({
      nose: centre('[data-hero-slot="nose-shape"]:not([display="none"])'),
      eyes: centre('[data-hero-motion="eye-blink"]'),
      ears: centre('[data-hero-slot="ear-shape"]:not([display="none"])'),
      glasses: centre('[data-hero-option="round-rim-glasses"]'),
      earrings: centre('[data-hero-option="hoop-earrings"]'),
      necklace: centre('[data-hero-option="campus-lanyard"]'),
      neck: centre('[data-hero-neck-base]'),
    });
    return ['default', 'broad', 'long-tapered-jaw'].map(headStyle => {
      const state = structuredClone(api.DEFAULTS);
      state.appearance.headStyle = headStyle;
      state.outfit.accessories = ['round-rim-glasses', 'hoop-earrings', 'campus-lanyard'];
      state.fineTune.head = { width: 12, height: -8, vertical: 4, spread: 0 };
      api.applyToSvg(svg, state);
      api.setHeadTurn(svg, 0);
      const front = sample();
      const frames = [-1, -.5, 0, .5, 1].map(turn => { api.setHeadTurn(svg, turn); return sample(); });
      api.setHeadTurn(svg, 1);
      const repeated = sample();
      api.applyToSvg(svg, state);
      const refitted = sample();
      api.setHeadTurn(svg, 0);
      const returned = sample();
      const copy = api.cloneSvg(svg, 'turn-clone');
      document.body.appendChild(copy);
      api.setHeadTurn(copy, -1);
      const sourceAfterCloneTurn = sample();
      copy.remove();
      return { headStyle, front, frames, repeated, refitted, returned, sourceAfterCloneTurn };
    });
  });
  for (const { headStyle, front, frames, repeated, refitted, returned, sourceAfterCloneTurn } of cases) {
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].nose, headStyle).toBeGreaterThan(frames[i - 1].nose);
      expect(frames[i].eyes).toBeGreaterThan(frames[i - 1].eyes);
      expect(frames[i].ears).toBeLessThan(frames[i - 1].ears);
    }
    for (const frame of frames) {
      expect(frame.glasses - frame.eyes).toBeCloseTo(front.glasses - front.eyes, 1);
      expect(frame.earrings - frame.ears).toBeCloseTo(front.earrings - front.ears, 1);
      expect(frame.necklace).toBeCloseTo(front.necklace, 4);
      expect(frame.neck).toBeCloseTo(front.neck, 4);
    }
    for (const key of Object.keys(front)) {
      expect(repeated[key]).toBeCloseTo(frames.at(-1)[key], 4);
      expect(refitted[key]).toBeCloseTo(repeated[key], 4);
      expect(returned[key]).toBeCloseTo(front[key], 4);
      expect(sourceAfterCloneTurn[key]).toBeCloseTo(front[key], 4);
    }
  }
});

test('fixed Prof and Bruin faces support bounded, reversible turns in both directions', async ({ page }) => {
  await openHero(page);
  const faces = await page.evaluate(() => {
    const api = window.HeroAvatar, svg = document.querySelector('[data-testid="turn-hero"]');
    return ['tobias', 'bruin'].map(kind => {
      api.applyToSvg(svg, { ...structuredClone(api.DEFAULTS), kind });
      const nose = svg.querySelector(kind === 'tobias' ? 'path[fill*="prof-nose"]' : '[data-hero-mascot-face="nose"]');
      const box = nose.getBBox();
      const xAt = turn => {
        api.setHeadTurn(svg, turn);
        return new DOMPoint(box.x + box.width / 2, box.y).matrixTransform(nose.getCTM()).x;
      };
      return { kind, left: xAt(-1), centre: xAt(0), right: xAt(1), clamped: xAt(5), restored: xAt(0) };
    });
  });
  for (const face of faces) {
    expect(face.left, face.kind).toBeLessThan(face.centre);
    expect(face.right).toBeGreaterThan(face.centre);
    expect(face.clamped).toBeCloseTo(face.right, 5);
    expect(face.restored).toBeCloseTo(face.centre, 5);
  }
});

test('reduced motion resets a turned hero and prevents subsequent animated turns', async ({ page }) => {
  await openHero(page);
  await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="turn-hero"]');
    window.HeroAvatar.applyToSvg(svg, structuredClone(window.HeroAvatar.DEFAULTS));
    window.HeroAvatar.setHeadTurn(svg, 1);
  });
  const hero = page.getByTestId('turn-hero');
  await expect(hero).toHaveAttribute('data-hero-head-turn', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(hero).toHaveAttribute('data-hero-head-turn', '0');
  await hero.evaluate(svg => window.HeroAvatar.setHeadTurn(svg, -1));
  await expect(hero).toHaveAttribute('data-hero-head-turn', '0');
});

test('draped scarf ends remain separate through fitting and head turns', async ({ page }) => {
  await openHero(page);
  const result = await page.evaluate(() => {
    const api = window.HeroAvatar, svg = document.querySelector('[data-testid="turn-hero"]');
    const problems = [];
    let visiblePanels = 0;
    for (const headStyle of ['default', 'broad', 'long-tapered-jaw']) {
      const state = structuredClone(api.DEFAULTS);
      state.appearance.headStyle = headStyle;
      state.outfit.accessories = ['draped-scarf'];
      state.fineTune.head = { width: 15, height: -10, vertical: 4, spread: 0 };
      api.applyToSvg(svg, state);
      const scarf = svg.querySelector('[data-hero-option="draped-scarf"]');
      for (const turn of [-1, -.5, 0, .5, 1, 0]) {
        api.setHeadTurn(svg, turn);
        const paintsAt = (x, y) => {
          const point = new DOMPoint(x, y).matrixTransform(scarf.getScreenCTM());
          return document.elementsFromPoint(point.x, point.y)
            .some(node => scarf.contains(node) && (node instanceof SVGGeometryElement || node instanceof SVGUseElement));
        };
        for (const x of [362, 438]) if (paintsAt(x, 280)) visiblePanels++;
        for (const x of [390, 400, 410]) {
          for (const y of [290, 292, 294]) {
            if (paintsAt(x, y)) problems.push({ headStyle, turn, x, y });
          }
        }
      }
    }
    return { problems, visiblePanels };
  });
  expect(result.visiblePanels, 'both hanging ends remain visible').toBe(36);
  expect(result.problems, 'neither an outline nor fold paint may bridge the open chest').toEqual([]);
});
