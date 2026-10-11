const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');

test.beforeEach(async ({ page }) => {
  await page.setContent('<main><div id="first"></div><div id="second"></div></main>');
  await page.addStyleTag({ path: path.join(root, 'css/git-graph.css') });
  for (const script of ['song-video/virtual-clock.js', 'git-graph.js', 'song-video/graph-track.js']) {
    await page.addScriptTag({ path: path.join(root, 'js', script) });
  }
  await page.evaluate(() => {
    window.keys = [
      { at: 0, state: { log: 'B|A|Second|HEAD -> main\nA||Initial', branches: '', head: 'refs/heads/main' } },
      { at: 2, state: { log: 'C|B|Third|HEAD -> main\nB|A|Second\nA||Initial', branches: '', head: 'refs/heads/main' } },
      { at: 5, state: { log: 'B|A|Second|HEAD -> main\nA||Initial', branches: '', head: 'refs/heads/main' } },
    ];
    window.parse = (key) => GitGraph.parseGitState(key.state.log, key.state.branches, key.state.head);
  });
});

test('graph callbacks use only their supplied scheduler and disposal cancels them', async ({ page }) => {
  const result = await page.evaluate(() => {
    const host = document.getElementById('first');
    const clock = VirtualClock.create();
    const graph = new GitGraph(host, { scheduler: clock });
    graph.render(parse(keys[0]));
    const enteringBefore = host.querySelectorAll('.entering').length;
    clock.advanceTo(1600);
    const enteringAfter = host.querySelectorAll('.entering').length;
    graph.render(parse(keys[1]));
    graph.dispose();
    const disposed = host.innerHTML;
    clock.advanceTo(10000);
    return { enteringBefore, enteringAfter, remainsDisposed: host.innerHTML === disposed };
  });
  expect(result.enteringBefore).toBeGreaterThan(0);
  expect(result.enteringAfter).toBe(0);
  expect(result.remainsDisposed).toBe(true);
});

test('disposed graphs are not retained by the theme observer', async ({ page }) => {
  const renders = await page.evaluate(async () => {
    const graph = new GitGraph(document.getElementById('first'));
    graph.render(parse(keys[0]));
    graph.dispose();
    let count = 0;
    graph.render = () => { count++; };
    document.documentElement.classList.toggle('dark-mode');
    await Promise.resolve();
    return count;
  });
  expect(renders).toBe(0);
});

test('song graph label colours stay legible on their dark canvas across page theme changes', async ({ page }) => {
  const fills = await page.evaluate(async () => {
    const host = document.getElementById('first');
    const track = new GraphTrack(host, keys);
    // Keep an ordinary graph's theme observer active too.
    const ordinary = new GitGraph(document.getElementById('second'));
    ordinary.render(parse(keys[0]));
    const labelFill = () => host.querySelector('.git-graph-branch-label').getAttribute('fill');
    track.pose(2.3);
    const lightPage = labelFill();
    document.documentElement.classList.add('dark-mode');
    await Promise.resolve();
    const darkPage = labelFill();
    document.documentElement.classList.remove('dark-mode');
    await Promise.resolve();
    const lightAgain = labelFill();
    return { lightPage, darkPage, lightAgain };
  });
  expect(fills.lightPage).toBe('#eef7ff');
  expect(fills.darkPage).toBe(fills.lightPage);
  expect(fills.lightAgain).toBe(fills.lightPage);
});

test('forward poses reuse their graph through the settled boundary', async ({ page }) => {
  const result = await page.evaluate(() => {
    const panel = document.getElementById('first');
    const track = new GraphTrack(panel, keys);
    track.pose(2);
    const canvas = panel.firstElementChild;
    const commit = panel.querySelector('[data-hash="B"]');
    for (let frame = 1; frame <= 150; frame++) track.pose(2 + frame / 60);
    const result = { canvas: panel.firstElementChild === canvas,
      commit: panel.querySelector('[data-hash="B"]') === commit };
    track.dispose();
    return result;
  });
  expect(result).toEqual({ canvas: true, commit: true });
});

test('portable edge geometry interpolates at exact seek time on touch devices', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    window.__prefersReducedMotion = () => true;
    window.track = new GraphTrack(document.getElementById('first'), keys);
    track.pose(2);
  });
  // The data-edge-key is GitGraph's explicit topology metadata. SVG path
  // coordinates are the rendering contract under test (CSS d is unsupported
  // in some engines), so read the attribute rather than a screenshot.
  const edge = page.locator('[data-edge-key="B__A"] path').first();
  const start = await edge.getAttribute('d');
  await page.evaluate(() => track.pose(2.36));
  const middle = await edge.getAttribute('d');
  await page.evaluate(() => track.pose(2.72));
  const end = await edge.getAttribute('d');
  const coords = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  expect(middle).not.toBe(start);
  expect(middle).not.toBe(end);
  coords(middle).forEach((coordinate, i) => {
    expect(coordinate).toBeCloseTo((coords(start)[i] + coords(end)[i]) / 2, 4);
  });
});

test('explicit song motion keeps nodes synchronized when the OS prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const positions = await page.evaluate(() => {
    const first = document.getElementById('first');
    const second = document.getElementById('second');
    const track = new GraphTrack(first, keys);
    const y = (panel) => new DOMMatrix(getComputedStyle(panel.querySelector('[data-hash="B"]')).transform).m42;
    track.pose(2);
    const start = y(first);
    track.pose(2.36);
    const middle = y(first);
    track.pose(2.72);
    const end = y(first);
    const ordinary = new GitGraph(second);
    ordinary.render(parse(keys[0]));
    ordinary.render(parse(keys[1]));
    return { start, middle, end, ordinary: y(second) };
  });
  expect(positions.start).not.toBe(positions.end);
  expect(positions.middle).toBeCloseTo((positions.start + positions.end) / 2, 4);
  expect(positions.ordinary).toBe(positions.end);
});

test('backward and interleaved seeks yield the same picture as a fresh track', async ({ page }) => {
  const pictures = await page.evaluate(() => {
    const first = document.getElementById('first');
    const second = document.getElementById('second');
    const track = new GraphTrack(first, keys);
    const other = new GraphTrack(second, keys);
    function picture(panel) {
      return [...panel.querySelectorAll('[data-hash], [data-edge-key] path')].map((el) => ({
        hash: el.getAttribute('data-hash'), d: el.getAttribute('d'),
        transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity,
      }));
    }
    track.pose(2);
    other.pose(5.2);
    track.pose(2.37);
    const forward = picture(first);
    track.pose(8);
    other.pose(1);
    track.pose(2.37);
    const backward = picture(first);
    other.pose(2.37);
    return { forward, backward, fresh: picture(second) };
  });
  expect(pictures.forward).toEqual(pictures.fresh);
  expect(pictures.backward).toEqual(pictures.fresh);
});

test('file-status panels keep their natural height through scaled playback and backward seeks', async ({ page }) => {
  const samples = await page.evaluate(() => {
    const reference = document.getElementById('first');
    const scaled = document.getElementById('second');
    for (const panel of [reference, scaled]) {
      panel.style.width = '500px';
      panel.style.transformOrigin = 'top left';
    }
    const states = ['unstaged', 'staged', 'unstaged', 'staged'].map((zone, index) => ({
      at: index * 2,
      state: {
        log: 'A||Initial commit|HEAD -> main', branches: '', head: 'refs/heads/main',
        files: { untracked: [], unstaged: [], staged: [], stashed: [], [zone]: [{ path: 'app.py', status: 'M' }] },
      },
    }));
    const referenceTrack = new GraphTrack(reference, states);
    const scaledTrack = new GraphTrack(scaled, states);
    // Workbench and filename rows are the shared graph's visible component
    // classes. Measure painted layout normalized by its containing scale,
    // without reading the graph's private reservation or CSS min-height pin.
    function picture(panel, scale) {
      const workbench = panel.querySelector('.git-workbench').getBoundingClientRect();
      const row = panel.querySelector('[data-path="app.py"]').getBoundingClientRect();
      return { height: workbench.height / scale, belowFile: (workbench.bottom - row.bottom) / scale };
    }
    const samples = [];
    for (const [time, scale] of [[1.8, 2], [3.8, 2], [5.8, 2], [7.8, 2], [1.8, 0.5], [3.8, 1.4], [5.8, 2], [7.8, 1]]) {
      scaled.style.transform = `scale(${scale})`;
      referenceTrack.pose(time);
      scaledTrack.pose(time);
      samples.push({ time, scale, reference: picture(reference, 1), scaled: picture(scaled, scale) });
    }
    referenceTrack.dispose();
    scaledTrack.dispose();
    return samples;
  });
  for (const sample of samples) {
    const context = `time=${sample.time}, scale=${sample.scale}`;
    expect(sample.scaled.height, `no extra panel space at ${context}`).toBeCloseTo(sample.reference.height, 1);
    expect(sample.scaled.belowFile, `no extra space below the filename at ${context}`).toBeCloseTo(sample.reference.belowFile, 1);
  }
});

test('falling commits keep the same anchor during playback and direct or backward seeks', async ({ page }) => {
  await page.addStyleTag({ path: path.join(root, 'css/song-video-stage.css') });
  await page.evaluate(() => { window.SongChoreographies = {}; });
  for (const script of ['timeline.js', 'kit.js', 'scene.js', 'songs/snapshots_and_pointers.js']) {
    await page.addScriptTag({ path: path.join(root, 'js/song-video', script) });
  }
  const storyboard = yaml.load(fs.readFileSync(path.join(root, '_data/songs/snapshots_and_pointers.yml'), 'utf8'));
  const positions = await page.evaluate((storyboard) => {
    const stage = document.getElementById('first');
    stage.className = 'stage';
    const build = () => SongScene.build(stage, storyboard, 'snapshots_and_pointers');
    const picture = () => [...stage.querySelectorAll('.falling-commit')].map((node) => {
      const box = node.getBoundingClientRect();
      return { text: node.textContent, x: box.x, y: box.y, opacity: getComputedStyle(node).opacity };
    });
    let scene = build();
    for (let frame = 0; frame <= 42; frame++) scene.seek(184.6 + frame / 60);
    scene.seek(185.3);
    const playback = picture();
    scene.dispose();
    scene = build();
    scene.seek(185.3);
    const direct = picture();
    scene.seek(200);
    scene.seek(185.3);
    const backward = picture();
    scene.dispose();
    return { playback, direct, backward };
  }, storyboard);
  expect(positions.playback.map((node) => node.text)).toEqual(['V', 'U']);
  expect(positions.playback.every((node) => Number(node.opacity) > 0)).toBe(true);
  expect(positions.direct).toEqual(positions.playback);
  expect(positions.backward).toEqual(positions.playback);
});
