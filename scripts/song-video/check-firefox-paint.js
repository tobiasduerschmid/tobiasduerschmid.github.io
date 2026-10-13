#!/usr/bin/env node
'use strict';
// Exercise real WebRender output. Playwright's Firefox screenshots and the
// default WebDriver screenshots use drawSnapshot, which misses this defect.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { PNG } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));

const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/song-video/check-firefox-paint.js /path/to/firefox [output-directory]');
const output = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'song-firefox-paint-'));
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'song-firefox-profile-'));
const repo = path.resolve(__dirname, '../..');
const url = (file) => pathToFileURL(path.join(repo, file)).href;
fs.writeFileSync(path.join(profile, 'user.js'), [
  'user_pref("remote.screenshot.use_readback", true);',
  'user_pref("layout.css.devPixelsPerPx", "1.5");',
  'user_pref("browser.shell.checkDefaultBrowser", false);',
  'user_pref("browser.aboutwelcome.enabled", false);',
].join('\n'));
const fixture = path.join(profile, 'paint.html');
fs.writeFileSync(fixture, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('css/song-video-stage.css')}">
<style>
body.stage { width:1280px; height:900px; background:#141827; overflow:visible; }
.samples { display:flex; flex-wrap:wrap; gap:10px; padding:20px; }
.sample { width:100px; height:100px; box-sizing:border-box; border:3px solid black;
  background:#40dc80; transform:perspective(100px) rotateX(10deg); }
</style></head><body class="stage"><main class="samples"></main>
<script src="${url('js/song-video/rounded-surfaces.js')}"></script>
<script>
for(let radius=1;radius<=50;radius++) {
  const sample=document.createElement('div');sample.className='sample';
  sample.style.borderRadius=radius+'px';document.querySelector('main').append(sample);
}
</script></body></html>`);

const child = spawn(executable, ['--no-remote', '--profile', profile, '--remote-debugging-port', '0', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
const exited = new Promise((resolve) => child.once('close', resolve));
let socket;
let sequence = 0;
const pending = new Map();
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const deadline = setTimeout(() => {
  console.error('Firefox paint check timed out.');
  process.exitCode = 1;
  socket?.close();
  child.kill();
}, 60000);

async function run() {
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const read = (chunk) => {
      log += chunk.toString();
      const match = log.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/);
      if (match) resolve(match[1] + '/session');
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Firefox exited before WebDriver was ready (${code}).\n${log}`)));
  });
  socket = new WebSocket(endpoint);
  socket.onclose = () => {
    for (const call of pending.values()) call.reject(new Error('Firefox WebDriver connection closed'));
    pending.clear();
  };
  socket.onmessage = ({ data }) => {
    const response = JSON.parse(data);
    const call = pending.get(response.id);
    if (!call) return;
    pending.delete(response.id);
    if (response.type === 'error') call.reject(new Error(JSON.stringify(response)));
    else call.resolve(response.result);
  };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  await command('session.new', { capabilities: {} });
  const { contexts } = await command('browsingContext.getTree');
  const context = contexts[0].context;
  await command('browsingContext.activate', { context });
  await command('browsingContext.navigate', { context, url: pathToFileURL(fixture).href, wait: 'complete' });
  const evaluate = async (expression) => {
    const result = await command('script.evaluate', { expression, target: { context }, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result));
    return result.result.value;
  };
  const geometry = JSON.parse(await evaluate(`JSON.stringify({ dpr:devicePixelRatio, boxes:[...document.querySelectorAll('.sample')].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}}) })`));
  async function capture(name) {
    // Readback is asynchronous with display composition. Poll for a painted
    // background; a black/blank frame must never count as a passing test.
    let buffer;
    let png;
    for (let attempt = 0; attempt < 60; attempt++) {
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const result = await command('browsingContext.captureScreenshot', { context });
      buffer = Buffer.from(result.data, 'base64');
      png = PNG.sync.read(buffer);
      if (png.data[0] === 20 && png.data[1] === 24 && png.data[2] === 39) break;
    }
    assert.equal(png.data[0], 20, 'Compositor must return the actual painted frame');
    fs.writeFileSync(path.join(output, name + '.png'), buffer);
    return png;
  }
  function interiorSeams(png) {
    let seams = 0;
    for (const b of geometry.boxes) {
      // The middle half is strictly inside even the roundest projected shape,
      // away from intentional edges and anti-aliasing. It must remain green.
      for (let y = Math.ceil((b.y + b.h * .25) * geometry.dpr); y < (b.y + b.h * .75) * geometry.dpr; y++) {
        for (let x = Math.ceil((b.x + b.w * .25) * geometry.dpr); x < (b.x + b.w * .75) * geometry.dpr; x++) {
          const index = (y * png.width + x) * 4;
          if (png.data[index + 1] < 180) seams++;
        }
      }
    }
    return seams;
  }
  const before = interiorSeams(await capture('before'));
  await evaluate('SongRoundedSurfaces.prepare(document.body)');
  // Confirm both the repaint and the oracle: the old defective frame must
  // not be mistaken for the new one while the compositor catches up.
  let after;
  for (let attempt = 0; attempt < 20; attempt++) {
    after = interiorSeams(await capture('after'));
    if (after === 0) break;
  }
  assert.equal(after, 0, 'Rounded shapes must have no interior border seams');
  const afterGeometry = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.sample')].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}}))`));
  assert.deepEqual(afterGeometry, geometry.boxes, 'Paint correction must not change layout');
  console.log(`Firefox compositor: ${before} defective interior pixels before, ${after} after; 50 rounded shapes; layout unchanged.\nCaptures: ${output}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline);
  socket?.close();
  child.kill();
  await exited;
  fs.rmSync(profile, { recursive: true, force: true });
});
