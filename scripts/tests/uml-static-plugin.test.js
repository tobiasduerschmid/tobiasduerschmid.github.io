'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { rendererFingerprint } = require('../../js/ArchUML/uml_to_svg');

const HARNESS_PATH = path.join(__dirname, 'fixtures', 'uml-static-harness.rb');
const REFERENCE_PATH = path.join(__dirname, '..', '..', 'js', 'ArchUML', 'REFERENCE.md');

function runPlugin(operation, input) {
  const stdout = execFileSync('ruby', [HARNESS_PATH], {
    encoding: 'utf8',
    input: JSON.stringify({ operation, ...input }),
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function attributeValues(html, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}=(['"])(.*?)\\1`, 'g');
  return [...html.matchAll(pattern)].map((match) => match[2]);
}

function localReferenceTargets(html) {
  const targets = [];

  for (const match of html.matchAll(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g)) {
    targets.push(match[1]);
  }
  for (const match of html.matchAll(/\b(?:href|xlink:href)=(['"])#([^'"]+)\1/g)) {
    targets.push(match[2]);
  }
  for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
    for (const value of attributeValues(html, attribute)) {
      targets.push(...value.trim().split(/\s+/));
    }
  }

  return targets;
}

const CACHED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-labelledby="diagram-title diagram-desc" aria-describedby="diagram-desc diagram-details">
  <title id="diagram-title">A diagram</title>
  <desc id="diagram-desc">Diagram details</desc>
  <defs>
    <linearGradient id="paint"><stop offset="0" /></linearGradient>
    <clipPath id="clip"><rect width="20" height="20" /></clipPath>
  </defs>
  <g id="diagram-details" clip-path="url(#clip)" aria-controls="shape">
    <path id="shape" fill="url(#paint)" d="M0 0L10 10" />
    <use href="#shape" xlink:href="#shape" />
  </g>
</svg>`;

test('identical cached diagrams get deterministic, occurrence-local SVG references', () => {
  const diagramBlock = '<pre><code class="language-uml-class">@startuml\nclass Example\n@enduml</code></pre>';
  const content = `<main>${diagramBlock}<p>Between diagrams</p>${diagramBlock}</main>`;
  const input = {
    content,
    svg: CACHED_SVG,
    page_identifier: '/SEBook/repeated-diagrams.html',
  };

  const first = runPlugin('process_cached_svg', input);
  const second = runPlugin('process_cached_svg', input);
  const ids = attributeValues(first.html, 'id');
  const references = localReferenceTargets(first.html);

  assert.equal((first.html.match(/<svg\b/g) || []).length, 2);
  assert.equal(attributeValues(first.html, 'role').filter((role) => role === 'img').length, 2);
  assert.deepEqual(attributeValues(first.html, 'aria-hidden'), ['true', 'true']);
  assert.equal(new Set(ids).size, ids.length, 'each emitted SVG id must be document-unique');
  for (const reference of references) {
    assert.equal(
      ids.filter((id) => id === reference).length,
      1,
      `local reference #${reference} must resolve exactly once`
    );
  }
  assert.equal(first.html, second.html, 'the same page and occurrence order must be stable');
  assert.equal(first.cached_svg, CACHED_SVG, 'the shared cache must remain canonical');
});

test('backslash sequences in rendered diagram text are inserted literally', () => {
  // Callout targets use JSON escapes, so a rendered label can contain `\&quot;`.
  const diagramBlock = '<pre><code class="language-uml-sequence">@startuml\na -&gt; b: post(\\"x\\")\n@enduml</code></pre>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>post(\\&quot;x\\&quot;) \\0 \\\\</text></svg>';
  const { html } = runPlugin('process_cached_svg', {
    content: `<main>${diagramBlock}</main>`,
    svg,
    page_identifier: '/SEBook/escaped-label.html',
  });

  assert.ok(html.includes('<text>post(\\&quot;x\\&quot;) \\0 \\\\</text>'), html);
  assert.ok(!html.includes('language-uml-sequence'), 'the source block must not be spliced back into the page');
});

test('SVG namespacing rewrites supported local references without touching colors or external URLs', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-labelledby="title desc orphan" aria-describedby="desc" aria-controls="panel" aria-owns="shape">
  <title id="title">Title</title><desc id="desc">Description</desc>
  <defs><linearGradient id="paint"/><clipPath id="clip"/><path id="shape"/><g id="panel"/><g id="map"/><g id="fff"/></defs>
  <style>.node { fill: url("#paint"); clip-path: url(#clip); background: url(https://cdn.example/asset.svg#paint); }</style>
  <rect fill="#fff" filter="url( '#clip' )" aria-activedescendant="shape"/>
  <use href="#shape" xlink:href="#shape"/>
  <a href="https://example.test/icons.svg#shape"><text>External</text></a>
  <div for="panel" headers="title desc" list="panel" itemref="shape panel" usemap="#map"/>
  <animate id="pulse" begin="shape.click; pulse.end+1s; indefinite" end="shape.mouseout"/>
</svg>`;

  const { svg: namespaced } = runPlugin('namespace_svg', {
    svg,
    namespace: 'uml-example-1',
  });

  for (const id of ['title', 'desc', 'paint', 'clip', 'shape', 'panel', 'map', 'fff', 'pulse']) {
    assert.match(namespaced, new RegExp(`\\bid=(['"])uml-example-1-${id}\\1`));
  }
  assert.match(namespaced, /aria-labelledby="uml-example-1-title uml-example-1-desc orphan"/);
  assert.match(namespaced, /aria-describedby="uml-example-1-desc"/);
  assert.match(namespaced, /aria-controls="uml-example-1-panel"/);
  assert.match(namespaced, /aria-owns="uml-example-1-shape"/);
  assert.match(namespaced, /aria-activedescendant="uml-example-1-shape"/);
  assert.match(namespaced, /href="#uml-example-1-shape"/);
  assert.match(namespaced, /xlink:href="#uml-example-1-shape"/);
  assert.match(namespaced, /url\("#uml-example-1-paint"\)/);
  assert.match(namespaced, /url\(#uml-example-1-clip\)/);
  assert.match(namespaced, /url\( '#uml-example-1-clip' \)/);
  assert.match(namespaced, /for="uml-example-1-panel"/);
  assert.match(namespaced, /headers="uml-example-1-title uml-example-1-desc"/);
  assert.match(namespaced, /itemref="uml-example-1-shape uml-example-1-panel"/);
  assert.match(namespaced, /usemap="#uml-example-1-map"/);
  assert.match(namespaced, /begin="uml-example-1-shape\.click; uml-example-1-pulse\.end\+1s; indefinite"/);
  assert.match(namespaced, /end="uml-example-1-shape\.mouseout"/);
  assert.match(namespaced, /fill="#fff"/);
  assert.match(namespaced, /href="https:\/\/example\.test\/icons\.svg#shape"/);
  assert.match(namespaced, /url\(https:\/\/cdn\.example\/asset\.svg#paint\)/);
});

test('syncbase references prefer the longest matching SVG id', () => {
  const { value } = runPlugin('rewrite_syncbase_references', {
    value: 'node.part.click; node.end',
    id_mapping: {
      node: 'short-id',
      'node.part': 'long-id',
    },
  });

  assert.equal(value, 'long-id.click; short-id.end');
});

test('static SVG cache fingerprints every renderer input', () => {
  const fileContents = {
    'js/ArchUML/uml-bundle.js': 'bundle source',
    'js/ArchUML/uml_to_svg.js': 'renderer driver source',
    'js/ArchUML/css/callouts.css': 'embedded callout theme',
    'js/git-graph.js': 'git graph source',
  };

  const fingerprints = runPlugin('renderer_fingerprints', {
    file_contents: fileContents,
  });

  assert.equal(fingerprints.baseline, fingerprints.repeated);
  for (const rendererInput of Object.keys(fileContents)) {
    assert.notEqual(
      fingerprints.changed[rendererInput],
      fingerprints.baseline,
      `${rendererInput} changes must invalidate cached SVGs`
    );
  }
});

test('renderer CLI cache fingerprints its driver and injected renderers', () => {
  const sources = {
    bundle: 'bundle source',
    driver: 'renderer driver source',
    gitGraph: 'git graph source',
  };
  const baseline = rendererFingerprint(sources);

  for (const rendererInput of Object.keys(sources)) {
    assert.notEqual(
      rendererFingerprint({ ...sources, [rendererInput]: `${sources[rendererInput]} changed` }),
      baseline,
      `${rendererInput} changes must invalidate the CLI cache`
    );
  }
});

test('malformed raw UML blocks cannot consume later preformatted code', () => {
  const malformed = `<pre><code class="language-uml-class">
@startuml
class Broken
note right of Broken
  <div class="highlight"><pre><code class="language-python">print("nested")</code></pre></div>
end note
@enduml
&lt;/code&gt;&lt;/pre&gt;
<pre><code class="language-javascript">console.log("unrelated")</code></pre>
<pre><code class="language-uml-state">@startuml
[*] --> Ready
@enduml</code></pre>`;

  const { blocks } = runPlugin('collect_code_blocks', { content: malformed });

  assert.deepEqual(blocks, [{
    type: 'state',
    text: '@startuml\n[*] --> Ready\n@enduml',
    caption: null,
    position: malformed.lastIndexOf('<pre><code class="language-uml-state">'),
  }]);
});

test('CRC fenced and raw blocks are recognized by the production diagram build', () => {
  const source = '@startuml\ncard Cart {\n responsibility: Know products\n}\n@enduml';
  const content = ['language-crc', 'diagram-crc'].map((className) =>
    `<pre><code class="${className}">${source}</code></pre>`
  ).join('\n');
  const { blocks } = runPlugin('collect_code_blocks', { content });
  assert.deepEqual(blocks.map(({ type, text }) => ({ type, text })), [
    { type: 'crc', text: source }, { type: 'crc', text: source }
  ]);
});

test('raw UML reference examples do not expose nested Markdown fences to Kramdown', () => {
  const reference = fs.readFileSync(REFERENCE_PATH, 'utf8');
  for (const language of ['Python', 'Java']) {
    const heading = `**Example — ${language} code in note:**`;
    const sectionStart = reference.indexOf(heading);
    const renderedExampleStart = reference.indexOf('<pre><code class="language-uml-class">', sectionStart);
    assert.ok(sectionStart >= 0 && renderedExampleStart > sectionStart);
    const displayedSource = reference.slice(sectionStart, renderedExampleStart);
    assert.match(
      displayedSource,
      /````\n@startuml[\s\S]*@enduml\n````\s*$/,
      'an outer four-backtick fence must contain the literal three-backtick note syntax',
    );
  }

  const rawDiagramBodies = Array.from(
    reference.matchAll(/^<pre><code\b[^>]*class=(['"])[^'"]*\blanguage-uml-[^'"]*\1[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gm),
    (match) => match[2],
  );

  assert.ok(rawDiagramBodies.length > 0, 'the reference should contain rendered UML examples');
  for (const body of rawDiagramBodies) {
    assert.doesNotMatch(
      body,
      /```/,
      'literal nested fences make Kramdown terminate or restructure a raw UML block',
    );
  }

  const codeInNoteExamples = rawDiagramBodies.filter((body) => body.includes('&#96;&#96;&#96;'));
  assert.ok(codeInNoteExamples.length >= 2, 'code-in-note examples should preserve encoded fences');
  for (const body of codeInNoteExamples) {
    assert.equal((body.match(/&#96;&#96;&#96;/g) || []).length, 2);
  }
});

// --- C4 figures (spec §6.5, §10) -------------------------------------------------------------------------

const REPO_ROOT = path.join(__dirname, '..', '..');
// The frozen Milestone 1 reference model (J13): chapter edits to the shared models in _includes/c4-models/ must not
// change what these static-prerender checks draw or describe.
const C4_MODEL = fs.readFileSync(path.join(REPO_ROOT, 'js', 'ArchUML', 'tests', 'c4', 'fixtures', 'course-registration.yml'), 'utf8');
const C4_SOURCE_PATTERN = /<script type="application\/json" data-c4-source>([\s\S]*?)<\/script>/g;

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const c4Fence = (text) => `<pre><code class="language-c4">${escapeHtml(text)}</code></pre>`;
const c4SourceElements = (html) => [...html.matchAll(C4_SOURCE_PATTERN)].map((match) => match[1]);

/** A small C4 design whose texts try to close the source element and inject markup. */
const HOSTILE_C4 = `view: context of shop
systems:
  shop:
    name: Shop
    description: Ends early </script><img src=x onerror="alert('x')"> & <!-- comment -->
people:
  buyer:
    name: Buyer
    collaborators:
      shop: buys from
`;

test('C4 fenced and raw data blocks are recognized by the production diagram build', () => {
  const source = 'view: containers of registration\nschema: c4-design/1';
  const fences = ['language-c4', 'diagram-c4'].map((className) =>
    `<pre><code class="${className}"># caption: Containers\n${source}</code></pre>`
  ).join('\n');
  const dataBlock = `<div data-uml-type="c4" data-uml-spec="${escapeHtml(source)}" data-uml-caption="From data"></div>`;

  assert.deepEqual(runPlugin('collect_code_blocks', { content: fences }).blocks.map(({ type, text, caption }) => ({ type, text, caption })), [
    { type: 'c4', text: source, caption: 'Containers' },
    { type: 'c4', text: source, caption: 'Containers' },
  ]);
  assert.deepEqual(runPlugin('collect_data_attribute_blocks', { content: dataBlock }).blocks, [
    { type: 'c4', text: source, caption: 'From data' },
  ]);
});

test('static SVG cache fingerprints the C4 manifest and every script it lists', () => {
  const manifest = { version: 1, core: ['vendor/lib.js', 'c4/c4-core.js'], render: ['c4/c4-render.js'], editor: [] };
  const fileContents = {
    'js/ArchUML/uml-bundle.js': 'bundle source',
    'js/ArchUML/uml_to_svg.js': 'renderer driver source',
    'js/ArchUML/css/callouts.css': 'embedded callout theme',
    'js/git-graph.js': 'git graph source',
    'js/ArchUML/c4/manifest.json': JSON.stringify(manifest),
    'js/ArchUML/vendor/lib.js': 'vendored library',
    'js/ArchUML/c4/c4-core.js': 'C4 core facade',
    'js/ArchUML/c4/c4-render.js': 'C4 renderer',
  };
  // The load order is part of the renderer: a reordered manifest is a different renderer.
  const reordered = { ...manifest, core: [...manifest.core].reverse() };

  const fingerprints = runPlugin('renderer_fingerprints', {
    file_contents: fileContents,
    changed_contents: { 'js/ArchUML/c4/manifest.json': JSON.stringify(reordered) },
  });

  assert.equal(fingerprints.baseline, fingerprints.repeated);
  for (const rendererInput of Object.keys(fileContents)) {
    assert.notEqual(
      fingerprints.changed[rendererInput],
      fingerprints.baseline,
      `${rendererInput} changes must invalidate cached SVGs`
    );
  }
});

test('renderer CLI cache fingerprints the C4 manifest and every script it lists', (t) => {
  const { readRendererInputs, rendererInputsFingerprint } = require('../../js/ArchUML/uml_to_svg');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uml-to-svg-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = { version: 1, core: ['vendor/lib.js', 'c4/c4-core.js'], render: ['c4/c4-render.js'], editor: [] };
  const files = {
    'uml-bundle.js': 'bundle source',
    'uml_to_svg.js': 'renderer driver source',
    'css/callouts.css': 'embedded callout theme',
    'c4/manifest.json': JSON.stringify(manifest),
    'vendor/lib.js': 'vendored library',
    'c4/c4-core.js': 'C4 core facade',
    'c4/c4-render.js': 'C4 renderer',
  };
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  };
  Object.entries(files).forEach(([name, content]) => write(name, content));
  const gitGraphPath = path.join(root, 'git-graph.js');
  write('git-graph.js', 'git graph source');
  const fingerprint = () => rendererInputsFingerprint(readRendererInputs(root, gitGraphPath));
  const baseline = fingerprint();

  assert.equal(fingerprint(), baseline);
  const changes = {
    ...Object.fromEntries(Object.entries(files).map(([name, content]) => [name, `${content}\nchanged`])),
    'c4/manifest.json': JSON.stringify({ ...manifest, core: [...manifest.core].reverse() }),
    'git-graph.js': 'git graph source\nchanged',
  };
  for (const [name, changed] of Object.entries(changes)) {
    const original = fs.readFileSync(path.join(root, name), 'utf8');
    write(name, changed);
    assert.notEqual(fingerprint(), baseline, `${name} changes must invalidate the CLI cache`);
    write(name, original);
  }
});

test('the real C4 manifest feeds the placement and routing modules to the prerender before the renderer', () => {
  const { readC4Scripts } = require('../../js/ArchUML/uml_to_svg');
  const files = readC4Scripts(path.join(REPO_ROOT, 'js', 'ArchUML')).map((script) => script.file);
  ['c4/c4-place.js', 'c4/c4-route.js'].forEach((file) => {
    assert.ok(files.includes(file), `the prerendered C4 scripts are ${files.join(', ')}`);
    assert.ok(files.indexOf(file) < files.indexOf('c4/c4-render.js'), `the prerendered C4 scripts are ${files.join(', ')}`);
  });
});

test('the prerender driver draws a C4 view with its SVG hooks', () => {
  const embed = `view: containers of registration\n${C4_MODEL}`;
  const stdout = execFileSync('node', [path.join(REPO_ROOT, 'js', 'ArchUML', 'uml_to_svg.js')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ 0: { type: 'c4', text: embed } }),
    maxBuffer: 16 * 1024 * 1024,
  });
  const svg = JSON.parse(stdout)['0'];

  assert.match(svg, /^<svg\b/);
  assert.match(svg, /data-layout-id="api"[^>]*data-c4-type="container"|data-c4-type="container"[^>]*data-layout-id="api"/);
  assert.match(svg, /data-c4-source="web"[^>]*data-c4-target="api"/);
});

test('a static C4 figure carries the source it was drawn from: the text without the caption line', () => {
  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence(`# caption: A shop\n${HOSTILE_C4}`)}</main>`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Shop</text></svg>',
    page_identifier: '/SEBook/c4-source.html',
  }).html;

  const sources = c4SourceElements(html);
  assert.equal(sources.length, 1, html);
  assert.ok(!sources[0].includes('<'), 'no "<" may appear inside the script element');
  // The build draws a block's text without its surrounding blank lines and keeps the source the same.
  assert.equal(JSON.parse(sources[0]), HOSTILE_C4.trim());
  const container = html.match(/<div class="uml-c4-diagram-container"[^>]*role="img"[^>]*>([\s\S]*?)<\/div>\s*<figcaption/);
  assert.ok(container && container[1].includes('data-c4-source'), 'the source element sits inside the figure container');
});

// The static wrapper must preserve the live figures' readable-fit policy.
test('static C4 and CRC figures keep readable text while UML figures use the shared fit', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Shop</text></svg>';
  const c4 = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence(HOSTILE_C4)}</main>`, svg, page_identifier: '/SEBook/c4-fit.html',
  }).html;
  const crc = runPlugin('process_cached_svg', {
    content: '<main><pre><code class="language-crc">card "Shop" as Shop {\nresponsibility: Know products\n}</code></pre></main>', svg, page_identifier: '/SEBook/crc-fit.html',
  }).html;
  const uml = runPlugin('process_cached_svg', {
    content: '<main><pre><code class="language-uml-class">class Shop</code></pre></main>', svg, page_identifier: '/SEBook/class-fit.html',
  }).html;

  assert.match(c4, /<div class="uml-c4-diagram-container"[^>]*\bdata-uml-fit="readable"/);
  assert.match(crc, /<div class="uml-crc-diagram-container"[^>]*\bdata-uml-fit="off"/);
  assert.doesNotMatch(uml, /data-uml-fit=/);
});

test('static figures preserve authored fit policies from both source forms', () => {
  const content = `<main>
    <div data-uml-type="c4" data-uml-spec="view: context of shop
systems:
  shop:
    name: Shop" data-uml-fit="off"></div>
    <pre data-uml-fit="readable"><code class="language-uml-class">class Shop</code></pre>
    <pre data-uml-fit="auto"><code class="language-crc">card "Shop" as Shop {
      responsibility: Know products
    }</code></pre>
  </main>`;
  const { html } = runPlugin('process_cached_svg', {
    content,
    svg: CACHED_SVG,
    page_identifier: '/SEBook/explicit-fit.html',
  });

  assert.equal((html.match(/<figure\b/g) || []).length, 3);
  assert.deepEqual(attributeValues(html, 'data-uml-fit'), ['off', 'readable', 'auto']);
});

test('figures of other diagram types carry no C4 source element', () => {
  const html = runPlugin('process_cached_svg', {
    content: '<main><pre><code class="language-uml-class">class Shop</code></pre></main>',
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Shop</text></svg>',
    page_identifier: '/SEBook/class.html',
  }).html;

  assert.deepEqual(c4SourceElements(html), []);
});

test('a static find-the-flaw C4 figure uses the authored description as its detailed description', () => {
  // The flaw: the web application's relationship to the API no longer says what it is for.
  const flawed = C4_MODEL.replace('{description: submits plans to, technology: JSON/HTTPS}', '{technology: JSON/HTTPS}');
  assert.notEqual(flawed, C4_MODEL);
  const authored = "Four relationships connect the student, the web app, the API, the database, and billing; one of them isn't labelled with its purpose.";
  const embed = `# caption: Find the flaw\n# description: ${authored}\nview: containers of registration\n${flawed}`;
  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence(embed)}</main>`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Registration</text></svg>',
    page_identifier: '/SEBook/c4-flaw.html',
    describer: 'real',
  }).html;

  const verbose = html.match(/<div class="sebook-figure__verbose-body">([\s\S]*?)<\/div>/);
  assert.ok(verbose, html);
  assert.ok(verbose[1].includes(`<li>${authored.replace(/'/g, '&#39;')}</li>`), verbose[1]);
  assert.ok(!verbose[1].includes('Registration API'), 'the generated element list is replaced');
  assert.match(html, /aria-label="Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships\."/);
});

// --- C4 HTML fragments: the interface card and C4 figure bodies (spec §6.6 "Static prerender", Ruling 20) -------

const C4_INTERFACES_MODEL = fs.readFileSync(path.join(REPO_ROOT, 'js', 'ArchUML', 'tests', 'c4', 'fixtures', 'course-registration-interfaces.yml'), 'utf8');

/** The card markup the renderer writes for `view: interface enrollment-api` with the given directives. */
function enrollmentCard(directives) {
  const core = require('../../js/ArchUML/c4/c4-core.js');
  const renderer = require('../../js/ArchUML/c4/c4-render.js');
  const view = core.project(core.load(C4_INTERFACES_MODEL), 'interface enrollment-api');
  return renderer.cardMarkup(view, { idPrefix: 'c4-card-1', panels: directives.panels });
}

test('the prerender driver returns the card markup for an interface view', () => {
  const embed = `view: interface enrollment-api\n${C4_INTERFACES_MODEL}`;
  const stdout = execFileSync('node', [path.join(REPO_ROOT, 'js', 'ArchUML', 'uml_to_svg.js')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ 0: { type: 'c4', text: embed } }),
    maxBuffer: 16 * 1024 * 1024,
  });
  const markup = JSON.parse(stdout)['0'];

  assert.match(markup, /^<article class="c4-interface" data-c4-interface="enrollment-api"/);
  assert.match(markup, /<\/article>$/);
});

test('a static interface card is text: no image role, no detailed description, ids local to the figure', () => {
  const embed = '# caption: The Enrollment API\n# panels: syntax\nview: interface enrollment-api\nschema: c4-design/1';
  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence(embed)}</main>`,
    svg: enrollmentCard({ panels: 'syntax' }),
    page_identifier: '/SEBook/c4-card.html',
    describer: 'real',
  }).html;

  const container = html.match(/<div class="uml-c4-diagram-container"[^>]*>/);
  assert.ok(container, html);
  assert.doesNotMatch(container[0], /\brole=/, 'the card container is not an image');
  assert.doesNotMatch(container[0], /\baria-label=/);
  assert.match(container[0], /\bdata-c4-notation="interface-card"/);
  assert.match(container[0], /\bdata-c4-panels="syntax"/);
  assert.doesNotMatch(html, /data-uml-verbose/, 'the card is its own text; no detailed description repeats it');
  assert.match(html, /<figcaption class="sebook-figure__caption">The Enrollment API<\/figcaption>/);
  assert.equal(c4SourceElements(html).length, 1, 'the card carries its source');

  const ids = attributeValues(html, 'id');
  assert.ok(ids.length > 0);
  assert.deepEqual(ids.filter((id) => !id.startsWith('uml-')), [], 'every id gets the figure namespace');
  for (const reference of localReferenceTargets(html)) {
    assert.equal(ids.filter((id) => id === reference).length, 1, `#${reference} resolves exactly once`);
  }
});

test('a static C4 figure body is an image whose drawings are hidden from assistive technology', () => {
  const body = '<div class="c4-figure-body"><p class="c4-figure-title">Interface view: Registration API</p>'
    + '<div class="c4-uml-view"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="inner"><text>API</text></svg></div>'
    + '<p>Ball: an interface the element provides.</p></div>';
  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence('view: interfaces of api\nschema: c4-design/1')}</main>`,
    svg: body,
    page_identifier: '/SEBook/c4-interfaces.html',
  }).html;

  const container = html.match(/<div class="uml-c4-diagram-container"[^>]*>/);
  assert.ok(container, html);
  assert.match(container[0], /\brole="img"/);
  assert.match(html, /<div class="c4-figure-body">/);
  assert.match(html, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" aria-hidden="true" focusable="false">/);
});

test('a self-closing drawing in a static C4 figure body stays self-closing when it is hidden from assistive technology', () => {
  const body = '<div class="c4-figure-body"><p class="c4-figure-title">A view</p>'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" role="img"/>'
    + '<div class="c4-uml-view"><svg xmlns="http://www.w3.org/2000/svg"><text>API</text></svg></div></div>';
  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence('view: interfaces of api\nschema: c4-design/1')}</main>`,
    svg: body,
    page_identifier: '/SEBook/c4-self-closing.html',
  }).html;

  assert.match(html, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="10" height="10" aria-hidden="true" focusable="false"\/>/);
  assert.match(html, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" aria-hidden="true" focusable="false"><text>API<\/text><\/svg>/);
  assert.doesNotMatch(html, /\/ aria-hidden/, 'no attribute follows the self-closing slash');
});

test('only the root of a static SVG figure is hidden from assistive technology; drawings nested in it keep their markup', () => {
  const nested = '<svg x="4" y="4" width="8" height="8" role="presentation"><circle r="2"/></svg>';
  const html = runPlugin('process_cached_svg', {
    content: '<main><pre><code class="language-uml-class">@startuml\nclass Example\n@enduml</code></pre></main>',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" role="img">${nested}</svg>`,
    page_identifier: '/SEBook/nested-svg.html',
  }).html;

  assert.match(html, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false">/);
  assert.ok(html.includes(nested), `the nested drawing is unchanged in:\n${html}`);
});

test('a static interfaces view is an image named by its brief whose title, drawing, legend, and notes come from the renderer', () => {
  const embed = `# caption: Interfaces of the coordinator\nview: interfaces of coordinator\n${C4_INTERFACES_MODEL}`;
  const stdout = execFileSync('node', [path.join(REPO_ROOT, 'js', 'ArchUML', 'uml_to_svg.js')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ 0: { type: 'c4', text: embed } }),
    maxBuffer: 16 * 1024 * 1024,
  });
  const body = JSON.parse(stdout)['0'];
  assert.match(body, /^<div class="c4-figure-body">/, 'the driver returns the whole figure body');

  const html = runPlugin('process_cached_svg', {
    content: `<main>${c4Fence(embed)}</main>`,
    svg: body,
    page_identifier: '/SEBook/c4-interfaces-view.html',
    describer: 'real',
  }).html;

  const container = html.match(/<div class="uml-c4-diagram-container"[^>]*>/);
  assert.ok(container, html);
  assert.match(container[0], /\brole="img"/);
  assert.match(container[0], /\baria-label="Interface view of Registration Coordinator: provides 1 interface, requires 0 interfaces, 1 connected element\."/);
  assert.match(html, /<p class="c4-figure-title">Interface view: Registration Coordinator<\/p>/);
  assert.match(html, /<p class="c4-figure-note">Enrollment API belongs to Registration API; Registration Coordinator handles its calls\.<\/p>/);
  const svgs = [...html.matchAll(/<svg\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(svgs.length, 1, 'one drawing');
  assert.match(svgs[0], /aria-hidden="true" focusable="false"/, 'the drawing is presentational inside the image');
  const verbose = html.match(/<div class="sebook-figure__verbose-body">([\s\S]*?)<\/div>/);
  assert.ok(verbose, 'the figure has its detailed description');
  for (const sentence of ['Ball: an interface the element provides.', 'Enrollment API belongs to Registration API; Registration Coordinator handles its calls.']) {
    assert.ok(verbose[1].includes(sentence), `${sentence} in ${verbose[1]}`);
  }
  assert.equal(c4SourceElements(html).length, 1, 'the figure carries its source');
});

// --- Static equals live for pinned UML views (RR-8; UML-view editing spec §6) -----------------------------------------
//
// A code, deployment, or interfaces view that keeps positions (and, in the first two, a bend) carries them in the
// ArchUML text the renderer draws, so every path draws one picture. Here a pinned view goes the whole static way, the
// prerender driver and then the plugin's rewrite of the figure, and is compared with the figure drawn live by
// `ArchUMLC4Render.render` in Chromium: node coordinates, route points, each pinned box on its pin, and the balls and
// sockets of the component diagram. The pinned design and the drawing probes are c4-delegated-view.test.js's.

test.describe('static C4 figures of pinned UML views', () => {
  const { chromium } = require('playwright');
  const { chromiumLaunchOptions } = require('../chromium-launch-options');
  const core = require('../../js/ArchUML/c4/c4-core.js');
  const delegated = require('./c4-delegated-view.test.js');

  let browser;
  let page;
  let pinned;
  test.before(async () => {
    browser = await chromium.launch(chromiumLaunchOptions());
    page = await delegated.openRendererPage(browser);
    pinned = await delegated.pinnedModel(page);
  });
  test.after(async () => { if (browser) await browser.close(); });

  delegated.POSITIONED_VIEWS.forEach((selector) => {
    test(`the static figure of the pinned ${selector} view equals its live figure, and each pinned box sits on its pin in both`, async () => {
      const embed = `view: ${selector}\n${pinned}`;
      const html = runPlugin('process_cached_svg', {
        content: `<main>${c4Fence(embed)}</main>`,
        svg: delegated.staticFigures({ figure: embed }).figure,
        page_identifier: `/SEBook/c4-pinned-${selector.replace(/\W+/g, '-')}.html`,
      }).html;

      const live = await delegated.drawLive(page, pinned, selector, 'render');
      const prerendered = await delegated.markupFacts(page, html, '.uml-c4-diagram-container svg');
      const pins = delegated.pinsByAlias(pinned, selector, core.toUml(core.project(core.load(pinned), selector)));

      assert.ok(pins.length > 0 && live.facts.nodes.length > 0, `the ${selector} view holds pins and layout hooks`);
      assert.deepEqual({ nodes: prerendered.nodes, routes: prerendered.routes }, { nodes: live.facts.nodes, routes: live.facts.routes },
        'node coordinates and route points');
      assert.deepEqual(prerendered.ports, live.facts.ports, 'balls and sockets');
      assert.deepEqual(delegated.offPins(live.facts, pins), [], 'the live boxes sit on their pins');
      assert.deepEqual(delegated.offPins(prerendered, pins), [], 'the static boxes sit on their pins');
    });
  });
});
