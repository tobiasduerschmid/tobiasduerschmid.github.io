#!/usr/bin/env node
// A/B guard (routing redesign §10, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md): renders every diagram
// of a corpus with two snapshots of ArchUML and byte-compares the drawings. Never writes into the repository; the
// snapshots and the prerender cache live in the folders given on the command line.
//
// Usage (from any folder):
//   node scripts/tools/c4-routing/ab-compare.js snapshot <dir>
//       Copies js/ArchUML/{uml-bundle.js,uml_to_svg.js,c4/,css/,vendor/} and js/git-graph.js from the working tree
//       into <dir>/js/..., and records the SHA-256 of every copied file in <dir>/SHA256SUMS. <dir> must not exist.
//   node scripts/tools/c4-routing/ab-compare.js count [--corpus component|deployment|c4]
//       Extracts the corpus and prints the count per source form and per file (no rendering).
//   node scripts/tools/c4-routing/ab-compare.js compare <snapA> <snapB> [--corpus …] [--widths 320,740,1200]
//       [--modes live,static] [--ignore <regex>]…
//       Checks the corpus counts against an independent substring count (and, for component diagrams, against the
//       pinned EXPECTED numbers), renders every source with A and with B, and byte-compares the drawings:
//         live   — the snapshot's bundle inlined, then the C4 manifest scripts loaded and one C4 view rendered (as a
//                  page with a C4 figure does after the stub's lazy load), then each source at every width;
//         static — the snapshot's own uml_to_svg.js in batch mode (C4 scripts before the bundle, as the prerender
//                  does), with its cache inside the snapshot, cleared before and after each run.
//       `--ignore` (repeatable) removes every match of a regular expression from both drawings before the A/B
//       comparison, never from the A/A control.
//       An A/A control comes first: A is rendered twice per mode and must match itself exactly. Every A-side drawing
//       must be a valid drawing of its type (no error text). Exit 0 only when all of that holds and A and B differ
//       nowhere.
//
// Corpora:
//   component  — every UML component diagram on the site (the §10 guard: component diagrams stay byte-identical);
//   deployment — every UML deployment diagram on the site;
//   c4         — every C4 figure on the site (fences, c4-view includes, data-uml-spec blocks, the reference's
//                examples) and the router's gated views (scripts/tests/c4-route-views.js) with the generated
//                landscapes. A refactor of the C4 modules must show 0 differences here.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const YAML = require('yaml');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');

const REPO = path.resolve(__dirname, '../../..');
const NODE_MODULES = path.join(REPO, 'node_modules');

// Counted on 2026-11-09 with the substring counts in independentCounts() and recounted on 2026-11-10 (REFERENCE.md
// gained the interfaces-view example, so 24 code blocks) and on 2026-11-24 (the compact-layout work merged from
// ArchUML main added two component examples to REFERENCE.md, so 26). Recompute at the start of the task that runs
// the guard, and update these numbers in that task if content changed since; never lower them to make a run pass.
// The other corpora are checked against the independent count only.
const EXPECTED = { component: { json: 45, dataSpec: 20, codeBlock: 26 } };
const FLOOR = { component: 80, deployment: 1, c4: 40 };

const C4_PROBE = [
  'schema: c4-design/1',
  'name: Probe',
  'people:',
  '  u:',
  '    name: User',
  '    collaborators:',
  '      s: uses',
  'systems:',
  '  s:',
  '    name: Probe System',
  '    description: Exists to load the C4 renderer.',
].join('\n');

// ---------------------------------------------------------------------------------------------- corpus

function walk(dir, accept, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (accept(full)) out.push(full);
  }
  return out;
}

/** Each real file once: _includes/REFERENCE.md is a symlink to js/ArchUML/REFERENCE.md. */
function unique(files) {
  const seen = new Set();
  return files.filter((file) => {
    if (!fs.existsSync(file)) return false;
    const real = fs.realpathSync(file);
    if (seen.has(real)) return false;
    seen.add(real);
    return true;
  });
}

const repoPath = (...parts) => path.join(REPO, ...parts);
const markupFiles = () => unique(walk(repoPath('SEBook'), (f) => /\.(md|html)$/.test(f))
  .concat(walk(repoPath('_includes'), (f) => /\.(md|html)$/.test(f)), [repoPath('js/ArchUML/REFERENCE.md'), repoPath('test-uml.html')]));
const dataSpecFiles = () => unique(walk(repoPath('SEBook'), (f) => /\.(md|html)$/.test(f))
  .concat(walk(repoPath('_data'), (f) => /\.ya?ml$/.test(f)), walk(repoPath('_includes'), (f) => /\.(md|html)$/.test(f)), [repoPath('test-uml.html')]));
const yamlFiles = () => unique(walk(repoPath('_data'), (f) => /\.ya?ml$/.test(f)));
// C4 includes hold Liquid templates (the editor embed's figure), not figures, so the c4 corpus skips _includes.
const c4DataSpecFiles = () => dataSpecFiles().filter((f) => !f.startsWith(repoPath('_includes') + path.sep));

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Form `json`: objects with `type: <type>` and a string `source` in `_data/**.json` (narration visuals). */
function jsonSources(type) {
  const out = [];
  for (const file of walk(repoPath('_data'), (f) => f.endsWith('.json'))) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { continue; }
    const visit = (node, trail) => {
      if (Array.isArray(node)) { node.forEach((value, i) => visit(value, trail.concat(String(i)))); return; }
      if (!node || typeof node !== 'object') return;
      if (node.type === type && typeof node.source === 'string') {
        out.push({ form: 'json', file, where: trail.join('.'), text: node.source });
        return;
      }
      for (const key of Object.keys(node)) visit(node[key], trail.concat(key));
    };
    visit(data, []);
  }
  return out;
}

/** Form `dataSpec`: `data-uml-type="<type>"` elements with a `data-uml-spec` attribute (either quote style). */
function dataSpecSources(type, files = dataSpecFiles()) {
  const out = [];
  const tag = new RegExp(`<[a-z]+\\b[^>]*?data-uml-type=(["'])${type}\\1[^>]*>`, 'gis');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(tag)) {
      // The spec attribute may contain '>' inside its quotes, so read it from the tag start, not the regex match.
      const spec = /data-uml-spec=(["'])([\s\S]*?)\1/.exec(text.slice(match.index));
      if (!spec) continue;
      let raw = spec[2];
      if (/\.ya?ml$/.test(file)) raw = raw.replace(/\\n/g, '\n');
      out.push({ form: 'dataSpec', file, where: 'offset ' + match.index, text: decodeEntities(raw) });
    }
  }
  return out;
}

/** Form `codeBlock`: bodies of `<pre><code class="language-<class>">` at a line start, HTML-decoded (prose that names the tag is skipped). */
function codeBlockSources(codeClass) {
  const out = [];
  const block = new RegExp(`^[ \\t]*<pre><code class="language-${codeClass}">([\\s\\S]*?)</code>`, 'gm');
  for (const file of markupFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(block)) {
      out.push({ form: 'codeBlock', file, where: 'offset ' + match.index, text: decodeEntities(match[1]).trim() });
    }
  }
  return out;
}

const C4_FENCE = /^```c4[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;

/** Form `fence`: ```c4 fences in SEBook Markdown and in YAML strings under _data (tutorial steps, quizzes). */
function fenceSources() {
  const out = [];
  for (const file of walk(repoPath('SEBook'), (f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(C4_FENCE)) out.push({ form: 'fence', file, where: 'offset ' + match.index, text: match[1] });
  }
  for (const file of yamlFiles()) {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.includes('```c4')) continue;
    const strings = [];
    const visit = (node) => {
      if (typeof node === 'string') strings.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(visit);
    };
    visit(YAML.parse(raw));
    strings.forEach((value, index) => {
      for (const match of value.matchAll(C4_FENCE)) out.push({ form: 'fence', file, where: `string ${index} offset ${match.index}`, text: match[1] });
    });
  }
  return out;
}

const INCLUDE = /\{%-?\s*include\s+c4-view\.html\b([\s\S]*?)-?%\}/g;

/** The text `_includes/c4-view.html` writes for an include's parameters: the directives, the view line, the model. */
function c4ViewText(parameters) {
  const value = (name) => (new RegExp(`\\b${name}="([^"]*)"`).exec(parameters) || [])[1];
  const model = fs.readFileSync(repoPath('_includes/c4-models', `${value('model')}.yml`), 'utf8');
  const panels = value('panels');
  return `${panels ? `# panels: ${panels}\n` : ''}view: ${value('view')}\n${model}`;
}

/** Form `include`: `{% include c4-view.html model="…" view="…" %}` in SEBook Markdown and test-uml.html. */
function includeSources() {
  const out = [];
  const files = walk(repoPath('SEBook'), (f) => f.endsWith('.md')).concat([repoPath('test-uml.html')]);
  for (const file of unique(files)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(INCLUDE)) out.push({ form: 'include', file, where: 'offset ' + match.index, text: c4ViewText(match[1]) });
  }
  return out;
}

/** Form `routeView`: the router's gated views and generated landscapes, as embed text (pins are not embed text). */
function routeViewSources() {
  const { VIEWS, LARGE_VIEW, GENERATED_VIEWS, generatedLandscape } = require('../../tests/c4-route-views.js');
  const file = repoPath('scripts/tests/c4-route-views.js');
  const views = VIEWS.map(([name, text, selector]) => ({ form: 'routeView', file, where: name, text: `view: ${selector}\n${text}` }));
  const generated = GENERATED_VIEWS.map(([seed, size]) => [seed, size]).concat([[LARGE_VIEW.seed, LARGE_VIEW.size]])
    .map(([seed, size]) => ({ form: 'routeView', file, where: `generated ${seed}/${size}`, text: `view: landscape\n${generatedLandscape(seed, size).text}` }));
  return views.concat(generated);
}

const CORPORA = {
  component: { renderer: 'UMLComponentDiagram', type: 'component', sources: () => jsonSources('component').concat(dataSpecSources('component'), codeBlockSources('uml-component')) },
  deployment: { renderer: 'UMLDeploymentDiagram', type: 'deployment', sources: () => jsonSources('deployment').concat(dataSpecSources('deployment'), codeBlockSources('uml-deployment')) },
  c4: { renderer: 'C4', type: 'c4', sources: () => fenceSources().concat(includeSources(), dataSpecSources('c4', c4DataSpecFiles()), codeBlockSources('c4'), routeViewSources()) },
};

function corpus(name) {
  return CORPORA[name].sources().map((s, index) => ({ ...s, id: `${s.form}:${path.relative(REPO, s.file)}:${s.where}`, index }));
}

/** Independent counts by plain substring search, to catch an extractor that silently finds too little. */
function independentCounts(name) {
  const count = (files, needle) => unique(files).reduce((n, f) => n + fs.readFileSync(f, 'utf8').split(needle).length - 1, 0);
  // A code block starts its line; prose that names the tag does not.
  const blockCount = (codeClass) => markupFiles().reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(new RegExp(`^[ \\t]*<pre><code class="language-${codeClass}">`, 'gm')) || []).length, 0);
  if (name === 'c4') {
    return {
      fence: count(walk(repoPath('SEBook'), (f) => f.endsWith('.md')).concat(yamlFiles()), '```c4'),
      include: count(walk(repoPath('SEBook'), (f) => f.endsWith('.md')).concat([repoPath('test-uml.html')]), 'include c4-view.html'),
      dataSpec: count(c4DataSpecFiles(), 'data-uml-type="c4"') + count(c4DataSpecFiles(), "data-uml-type='c4'"),
      codeBlock: blockCount('c4'),
    };
  }
  const json = walk(repoPath('_data'), (f) => f.endsWith('.json'))
    .reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(new RegExp(`"type"\\s*:\\s*"${name}"`, 'g')) || []).length, 0);
  return {
    json,
    dataSpec: count(dataSpecFiles(), `data-uml-type="${name}"`) + count(dataSpecFiles(), `data-uml-type='${name}'`),
    codeBlock: blockCount(`uml-${name}`),
  };
}

function report(sources) {
  const perForm = {};
  const perFile = {};
  for (const s of sources) {
    perForm[s.form] = (perForm[s.form] || 0) + 1;
    const key = `${s.form}  ${path.relative(REPO, s.file)}`;
    perFile[key] = (perFile[key] || 0) + 1;
  }
  console.log('per form:', JSON.stringify(perForm));
  for (const key of Object.keys(perFile).sort()) console.log(`  ${String(perFile[key]).padStart(3)}  ${key}`);
  console.log('total:', sources.length);
  return perForm;
}

function checkCounts(name, sources) {
  const perForm = report(sources);
  const grep = independentCounts(name);
  console.log('independent count:', JSON.stringify(grep), 'expected:', JSON.stringify(EXPECTED[name] || 'none pinned'));
  const problems = [];
  for (const form of Object.keys(grep)) {
    if ((perForm[form] || 0) !== grep[form]) problems.push(`${form}: extracted ${perForm[form] || 0}, independent count ${grep[form]}`);
  }
  for (const [form, expected] of Object.entries(EXPECTED[name] || {})) {
    if ((perForm[form] || 0) !== expected) problems.push(`${form}: extracted ${perForm[form] || 0}, expected ${expected}`);
  }
  if (sources.length < FLOOR[name]) problems.push(`total ${sources.length} below floor ${FLOOR[name]}`);
  return problems;
}

// ---------------------------------------------------------------------------------------------- snapshot

function copyInto(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

function snapshot(snapDir) {
  if (fs.existsSync(snapDir)) throw new Error(`${snapDir} exists; pick a new folder so a baseline is never overwritten`);
  const archuml = repoPath('js/ArchUML');
  for (const part of ['uml-bundle.js', 'uml_to_svg.js', 'c4', 'css', 'vendor']) {
    copyInto(path.join(archuml, part), path.join(snapDir, 'js/ArchUML', part));
  }
  copyInto(repoPath('js/git-graph.js'), path.join(snapDir, 'js/git-graph.js'));
  const lines = walk(snapDir, () => true).sort()
    .map((f) => `${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}  ${path.relative(snapDir, f)}`);
  fs.writeFileSync(path.join(snapDir, 'SHA256SUMS'), lines.join('\n') + '\n');
  console.log(lines.filter((l) => /uml-bundle\.js|manifest\.json/.test(l)).join('\n'));
  console.log(`snapshot written to ${snapDir} (${lines.length} files, SHA256SUMS beside them)`);
}

function readSnap(snapDir) {
  const dir = path.join(snapDir, 'js/ArchUML');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'c4/manifest.json'), 'utf8'));
  return {
    bundle: fs.readFileSync(path.join(dir, 'uml-bundle.js'), 'utf8'),
    c4: manifest.core.concat(manifest.render).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')),
  };
}

// ---------------------------------------------------------------------------------------------- render

/** Whether `markup` is a drawing of its corpus: a drawn SVG (or, for C4, an interface card) without error text. */
function looksValid(name, markup) {
  if (typeof markup !== 'string' || /^Error\b|could not be (loaded|parsed)|uml-error-msg/i.test(markup)) return false;
  if (name === 'component') return markup.startsWith('<svg') && /data-layout-id=|class="[^"]*uml-component/.test(markup);
  if (name === 'deployment') return markup.startsWith('<svg') && /data-layout-id=/.test(markup);
  return /<svg\b|<article class="c4-interface"/.test(markup);
}

/** In the page: draws `text` into the container at `width` and returns the drawing's markup. */
async function drawInPage(page, renderer, text, width) {
  return page.evaluate(async ({ rendererName, source, containerWidth }) => {
    const container = document.getElementById('c');
    container.style.width = containerWidth + 'px';
    container.replaceChildren();
    try {
      if (rendererName === 'C4') window.ArchUMLC4Render.render(container, source);
      else window[rendererName].render(container, source);
    } catch (err) { return 'Error: ' + err.message; }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (rendererName === 'C4') return container.innerHTML;
    const svg = container.querySelector('svg');
    return svg ? svg.outerHTML : 'Error: no svg';
  }, { rendererName: renderer, source: text, containerWidth: width });
}

async function renderLive(browser, snapDir, name, sources, widths) {
  const snap = readSnap(snapDir);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const scripts = [snap.bundle].concat(snap.c4).map((s) => `<script>${s}</script>`).join('\n');
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A/B</title>${scripts}</head><body><div id="probe"></div><div id="c"></div></body></html>`);
  await page.evaluate(async (probe) => {
    await document.fonts.ready;
    // Exercise the C4 renderer the way a page with a C4 figure does, before any other diagram renders.
    if (window.ArchUMLC4Render && window.ArchUMLC4Render.render) window.ArchUMLC4Render.render(document.getElementById('probe'), probe);
  }, C4_PROBE);
  const out = {};
  for (const width of widths) {
    for (const s of sources) out[`${width}|${s.id}`] = await drawInPage(page, CORPORA[name].renderer, s.text, width);
  }
  await page.close();
  return out;
}

function renderStatic(snapDir, name, sources) {
  const cache = path.join(snapDir, '.uml_cache');
  fs.rmSync(cache, { recursive: true, force: true });
  const input = {};
  for (const s of sources) input[s.id] = { type: CORPORA[name].type, text: s.text };
  const run = spawnSync(process.execPath, [path.join(snapDir, 'js/ArchUML/uml_to_svg.js')], {
    input: JSON.stringify(input), env: { ...process.env, NODE_PATH: NODE_MODULES }, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8',
  });
  fs.rmSync(cache, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(`static render failed for ${snapDir}: ${run.stderr}`);
  const raw = JSON.parse(run.stdout);
  return Object.fromEntries(Object.keys(raw).map((id) => [`static|${id}`, raw[id]]));
}

/**
 * The keys whose drawings differ, after every match of each `ignore` pattern is removed from both sides (a change
 * that is meant to add an attribute or rename ids can show that nothing else changed).
 */
function differences(a, b, ignore = []) {
  const kept = (markup) => ignore.reduce((text, pattern) => String(text).replace(pattern, ''), markup);
  return Object.keys(a).filter((key) => kept(a[key]) !== kept(b[key]));
}

async function compare(snapA, snapB, name, widths, modes, ignore) {
  const sources = corpus(name);
  const problems = checkCounts(name, sources);
  if (problems.length) { console.error('corpus check failed:\n  ' + problems.join('\n  ')); process.exit(2); }
  const browser = await chromium.launch(chromiumLaunchOptions());
  let failed = false;
  try {
    for (const mode of modes) {
      const render = mode === 'live' ? (snap) => renderLive(browser, snap, name, sources, widths) : async (snap) => renderStatic(snap, name, sources);
      const a1 = await render(snapA);
      const invalid = Object.keys(a1).filter((key) => !looksValid(name, a1[key]));
      const a2 = await render(snapA);
      const aa = differences(a1, a2);
      const b = await render(snapB);
      const ab = differences(a1, b, ignore);
      console.log(`[${name} ${mode}] renders per side: ${Object.keys(a1).length}; invalid A outputs: ${invalid.length}; A/A differences: ${aa.length}; A/B differences: ${ab.length}`);
      invalid.slice(0, 10).forEach((key) => console.log('  invalid:', key, String(a1[key]).slice(0, 120)));
      aa.slice(0, 10).forEach((key) => console.log('  A/A:', key));
      ab.slice(0, 40).forEach((key) => console.log('  A/B:', key));
      if (invalid.length || aa.length || ab.length || !Object.keys(a1).length) failed = true;
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? 'FAIL' : 'PASS');
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------- cli

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const flag = (flagName, fallback) => { const i = args.indexOf(flagName); return i >= 0 ? args[i + 1] : fallback; };
  const name = flag('--corpus', 'component');
  if (!CORPORA[name]) throw new Error(`unknown corpus ${name}; use one of ${Object.keys(CORPORA).join(', ')}`);
  if (command === 'snapshot') return snapshot(path.resolve(args[0]));
  if (command === 'count') {
    const problems = checkCounts(name, corpus(name));
    if (problems.length) { console.error(problems.join('\n')); process.exit(2); }
    return undefined;
  }
  if (command === 'compare') {
    const widths = flag('--widths', '320,740,1200').split(',').map(Number);
    const modes = flag('--modes', 'live,static').split(',');
    const ignore = args.flatMap((arg, i) => (arg === '--ignore' ? [new RegExp(args[i + 1], 'g')] : []));
    return compare(path.resolve(args[0]), path.resolve(args[1]), name, widths, modes, ignore);
  }
  console.error('usage: ab-compare.js snapshot <dir> | count [--corpus c] | compare <snapA> <snapB> [--corpus c] [--widths …] [--modes live,static] [--ignore regex]…');
  process.exit(64);
}

main().catch((err) => { console.error((err && err.stack) || err); process.exit(1); });
