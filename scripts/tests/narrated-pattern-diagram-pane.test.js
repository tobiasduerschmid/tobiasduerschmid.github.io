'use strict';

// Narrated lessons copy the SVG drawn at build time, in a wide headless page,
// into a lesson column about 600 px wide. A bare `layout compact` is therefore
// sized for that column by the include that assembles each cue's spec.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');

function renderDiagram(diagram, cue = {}) {
  const html = execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    input = JSON.parse(STDIN.read)
    template = Liquid::Template.parse('{% include narrated-pattern-diagram.html diagram=diagram cue=cue %}')
    print template.render!(input, registers: { site: site })
  `], { cwd: root, input: JSON.stringify({ diagram, cue }), encoding: 'utf8' });
  const attribute = name => {
    const match = html.match(new RegExp(`${name}="([^"]*)"`));
    assert.ok(match, `the diagram carries ${name}`);
    return match[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  };
  return { spec: attribute('data-uml-spec'), source: attribute('data-np-diagram-source') };
}

const lines = text => text.split('\n');

test('a bare compact line is laid out for the lesson column, in the drawn spec and its copy source', () => {
  const { spec, source } = renderDiagram({ type: 'state', source: '@startuml\nlayout compact\n[*] --> Idle\n@enduml' });
  assert.ok(lines(spec).includes('layout compact 600x700'), spec);
  assert.ok(!lines(spec).includes('layout compact'), spec);
  assert.ok(lines(source).includes('layout compact 600x700'), source);
});

test('the pane is added to stepped diagrams after their steps are assembled', () => {
  const { spec } = renderDiagram({ type: 'sequence', source: '@startuml\nlayout compact\nparticipant a: A\n',
    steps: ['a -> a: one()\n', 'a -> a: two()\n'] }, { diagram_steps: 1 });
  assert.equal(spec, '@startuml\nlayout compact 600x700\nparticipant a: A\na -> a: one()\n@enduml');
});

test('focus marking still applies to the sized spec', () => {
  const { spec } = renderDiagram({ type: 'class', source: '@startuml\nlayout compact\nclass Channel\n@enduml' },
    { diagram_focus: 'Channel' });
  assert.ok(lines(spec).includes('layout compact 600x700'), spec);
  assert.ok(lines(spec).includes('class Channel #fff0ac hatched'), spec);
});

test('a compact line that names its own pane is kept', () => {
  const { spec } = renderDiagram({ type: 'state', source: '@startuml\nlayout compact 480x900\n[*] --> Idle\n@enduml' });
  assert.ok(lines(spec).includes('layout compact 480x900'), spec);
});

test('a diagram without layout compact is passed through unchanged', () => {
  const source = '@startuml\nlayout landscape\n  class A\nA --> B\n@enduml';
  assert.equal(renderDiagram({ type: 'class', source }).spec, source);
});
