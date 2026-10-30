'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BUILDER_PATH = path.join(__dirname, 'fixtures', 'uml-static-incremental.rb');
const BUNDLE = 'js/ArchUML/uml-bundle.js';

// Stands in for the Chromium renderer: every diagram shows the version written
// in the bundle, so the page tells which renderer drew it.
const STUB_RENDERER = `
const fs = require('fs');
const path = require('path');
const version = fs.readFileSync(path.join(__dirname, 'uml-bundle.js'), 'utf8').match(/renderer (v\\d+)/)[1];
const blocks = JSON.parse(fs.readFileSync(0, 'utf8'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>drawn by renderer ' + version + '</text></svg>';
process.stdout.write(JSON.stringify(Object.fromEntries(Object.keys(blocks).map((id) => [id, svg]))));
`;

function page(version) {
  return `---
static_uml: true
---
<html><body>
<p>Page version ${version}</p>
<pre><code class="language-uml-class">abstract class Channel {
  +name: String
}</code></pre>
</body></html>
`;
}

function createSite(t) {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'uml-static-incremental-'));
  t.after(() => fs.rmSync(site, { recursive: true, force: true }));
  const files = {
    '_config.yml': 'title: incremental UML test\n',
    'index.html': page(1),
    [BUNDLE]: '// renderer v1\n',
    'js/ArchUML/uml_to_svg.js': STUB_RENDERER,
    'js/uml-describe-cli.js': 'process.stdout.write("{}");\n',
  };
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(site, name)), { recursive: true });
    fs.writeFileSync(path.join(site, name), content);
  }
  return site;
}

// One builder process is one long-running `jekyll serve --incremental`.
function serve(site, mode, steps) {
  const stdout = execFileSync('bundle', ['exec', 'ruby', BUILDER_PATH, site, mode], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: steps.map((step) => JSON.stringify(step)).join('\n') + '\n',
  });
  return stdout.trim().split('\n').map((line) => JSON.parse(line));
}

test('a running incremental build redraws pre-rendered diagrams after a renderer change', (t) => {
  const site = createSite(t);
  const builds = serve(site, 'plugin', [
    {},
    {},
    { files: { [BUNDLE]: '// renderer v2\n' } },
    { files: { 'index.html': page(2) } },
    { files: { [BUNDLE]: '// renderer v3\n' } },
  ]);

  assert.equal(builds[0].diagram, 'drawn by renderer v1');
  assert.equal(builds[1].rewritten, false, 'unchanged inputs keep the page');
  assert.equal(builds[2].diagram, 'drawn by renderer v2');
  assert.deepEqual([builds[3].text, builds[3].diagram], ['Page version 2', 'drawn by renderer v2']);
  assert.equal(builds[4].diagram, 'drawn by renderer v3', 'a page edit keeps the renderer dependency');
});

test('a page built before the renderer was tracked is redrawn once', (t) => {
  const site = createSite(t);
  const [plain] = serve(site, 'plain', [{}]);
  assert.equal(plain.diagram, null);

  const builds = serve(site, 'plugin', [{}, {}]);
  assert.equal(builds[0].diagram, 'drawn by renderer v1');
  assert.equal(builds[1].rewritten, false, 'the redraw happens only once');
});
