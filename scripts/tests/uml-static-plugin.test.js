'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
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
