'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BUILDER_PATH = path.join(__dirname, 'fixtures', 'narration-incremental.rb');

// The three ways a page names the narration it renders: a chapter's include,
// and the `topic` or `narration` front matter of reader and notes views.
const PAGES = {
  'chapter.html': '---\n---\n{% include narration.html topic="demo" %}\n',
  'reader.html': '---\ntopic: demo\n---\n{% include narration.html topic=page.topic %}\n',
  'notes.html': '---\nnarration: demo\n---\n{% include narration.html topic=page.narration %}\n',
};

// Stands in for the narration includes: it shows one value from the script,
// the visuals, and a companion, so the page tells which data it was built from.
const NARRATION_INCLUDE = `{%- assign notes = include.topic | append: '_notes' -%}
script {{ site.data.narrations[include.topic].version }}, visuals {{ site.data.narration_visuals[include.topic].version }}, notes {{ site.data.explainers[notes].version }}
`;

function createSite(t) {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'narration-incremental-'));
  t.after(() => fs.rmSync(site, { recursive: true, force: true }));
  const files = {
    '_config.yml': 'title: incremental narration test\n',
    '_includes/narration.html': NARRATION_INCLUDE,
    '_data/narrations/demo.yml': 'version: 1\n',
    '_data/narration_visuals/demo.json': '{"version": 1}\n',
    '_data/explainers/demo_notes.yml': 'version: 1\n',
    '_data/narrations/other.yml': 'version: 1\n',
    '_data/narration_visuals/other.json': '{"version": 1}\n',
    ...PAGES,
  };
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(site, name)), { recursive: true });
    fs.writeFileSync(path.join(site, name), content);
  }
  return site;
}

// One builder process is one long-running `jekyll serve --incremental`.
function serve(site, steps) {
  const stdout = execFileSync('bundle', ['exec', 'ruby', BUILDER_PATH, site, ...Object.keys(PAGES)], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: steps.map((step) => JSON.stringify(step)).join('\n') + '\n',
  });
  return stdout.trim().split('\n').map((line) => JSON.parse(line));
}

test('a running incremental build rebuilds every page that shows a narration when its data changes', (t) => {
  const site = createSite(t);
  const builds = serve(site, [
    {},
    {},
    { files: { '_data/narration_visuals/demo.json': '{"version": 2}\n' } },
    { files: { '_data/narrations/demo.yml': 'version: 2\n' } },
    { files: { '_data/explainers/demo_notes.yml': 'version: 2\n' } },
    { files: { '_data/narration_visuals/other.json': '{"version": 2}\n' } },
  ]);

  for (const name of Object.keys(PAGES)) {
    assert.equal(builds[0][name].shows, 'script 1, visuals 1, notes 1', `${name} renders the narration data`);
    assert.equal(builds[1][name].rewritten, false, `${name}: unchanged data keeps the page`);
    assert.equal(builds[2][name].shows, 'script 1, visuals 2, notes 1', `${name}: a visuals edit rebuilds the page`);
    assert.equal(builds[3][name].shows, 'script 2, visuals 2, notes 1', `${name}: a script edit rebuilds the page`);
    assert.equal(builds[4][name].shows, 'script 2, visuals 2, notes 2', `${name}: a companion edit rebuilds the page`);
    assert.equal(builds[5][name].rewritten, false, `${name}: another narration's data leaves the page alone`);
  }
});
