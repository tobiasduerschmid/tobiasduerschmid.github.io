// Starter files in the tutorial print view (_includes/tutorial-print-content.html).
// With `print_unchanged_files: false`, a codebase shared by every step
// (`shared_files`) prints once, and each later step says so in one line;
// steps that list their own `files` keep one note per unchanged file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

/** Render the print view of each tutorial, one after another as on a course page. */
function renderPrint(tutorials) {
  return execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    tutorials = JSON.parse(STDIN.read)
    template = Liquid::Template.parse(tutorials.keys.map { |key| "{% include tutorial-print-content.html tutorial='#{key}' %}" }.join)
    puts template.render!({ 'site' => { 'data' => { 'tutorials' => tutorials } } }, registers: { site: site })
  `], { cwd: root, input: JSON.stringify(tutorials), encoding: 'utf8' });
}

/** The visible text of each printed step, in order. */
function printedSteps(html) {
  return html.split('<div class="step">').slice(1)
    .map(step => step.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

const occurrences = (text, part) => text.split(part).length - 1;

const codebase = ['README.md', 'app/main.py', 'app/util.py']
  .map((file, index) => ({ path: file, content: `codebase line ${index}\n` }));

function tutorial(settings) {
  return {
    title: 'Fixture', backend: 'pyodide', ...settings,
    steps: ['One', 'Two', 'Three'].map(title => ({ title, instructions: `Step ${title}.` })),
  };
}

test('a shared codebase prints once, and each later step notes it in one line', () => {
  const steps = printedSteps(renderPrint({ shared: tutorial({ shared_files: codebase, print_unchanged_files: false }) }));

  assert.equal(steps.length, 3);
  for (const file of codebase) {
    assert.equal(occurrences(steps[0], file.content.trim()), 1, `${file.path} prints in step 1`);
    assert.equal(occurrences(steps.slice(1).join(' '), file.content.trim()), 0, `${file.path} does not print again`);
  }
  for (const step of steps.slice(1)) {
    assert.equal(occurrences(step, 'All 3 starter files are unchanged from step 1.'), 1);
    assert.equal(occurrences(step, ' is unchanged from step'), 0, 'no note per file');
  }
});

test('without print_unchanged_files: false, every step prints the shared codebase', () => {
  const steps = printedSteps(renderPrint({ shared: tutorial({ shared_files: codebase }) }));

  for (const step of steps) {
    for (const file of codebase) assert.equal(occurrences(step, file.content.trim()), 1);
    assert.equal(occurrences(step, 'unchanged'), 0);
  }
});

test('steps with their own files keep one note per unchanged file', () => {
  const own = tutorial({ print_unchanged_files: false });
  own.steps[0].files = codebase;
  own.steps[1].files = [codebase[0], { ...codebase[1], content: 'codebase line 1, edited\n' }, codebase[2]];
  const steps = printedSteps(renderPrint({ own }));

  assert.equal(occurrences(steps[1], 'README.md is unchanged from step 1.'), 1);
  assert.equal(occurrences(steps[1], 'app/util.py is unchanged from step 1.'), 1);
  assert.equal(occurrences(steps[1], 'codebase line 1, edited'), 1, 'the edited file prints');
  assert.equal(occurrences(steps[1], 'starter files are unchanged'), 0);
});

test('each tutorial on a course page prints its own shared codebase once', () => {
  const shared = { shared_files: codebase, print_unchanged_files: false };
  const steps = printedSteps(renderPrint({ first: tutorial(shared), second: tutorial(shared) }));

  assert.equal(steps.length, 6);
  for (const first of [steps[0], steps[3]]) {
    for (const file of codebase) assert.equal(occurrences(first, file.content.trim()), 1);
  }
  assert.equal(occurrences(steps[4], 'All 3 starter files are unchanged from step 1.'), 1);
});
